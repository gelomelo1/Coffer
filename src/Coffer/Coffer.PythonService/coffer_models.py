"""Coffer's model files and how to run them — the contract between Coffer.Manager (which trains and saves models)
and Coffer.PythonService (which serves them). This file is kept byte-identical in both projects; a Manager test
compares the two copies.

Embedding model (.pt): a dict {"format": "coffer.embedding.v1", backbone, embedding_dim, image_size, mean, std,
thresholds {found, similar} (cosine), classes, run_id, state_dict}. Models saved before this format (a raw ResNet18
state dict with a 256-d head and a classifier) still load, with the thresholds the service used for them.

Detection model (.pt): an Ultralytics checkpoint, optionally with a "coffer" entry {format: "coffer.detection.v1",
imgsz, confidence, run_id}. Without it, the image size comes from the training arguments and the confidence is 0.9.
"""
from dataclasses import dataclass, field

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torch import nn
from torchvision import models, transforms

EMBEDDING_FORMAT = "coffer.embedding.v1"
DETECTION_FORMAT = "coffer.detection.v1"
LEGACY_THRESHOLDS = {"found": 0.975, "similar": 0.925}
LEGACY_CONFIDENCE = 0.9
BACKBONES = ("resnet18", "resnet50")
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def _resnet(backbone: str, pretrained: bool) -> nn.Module:
    if backbone == "resnet18":
        return models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
    if backbone == "resnet50":
        return models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1 if pretrained else None)
    raise ValueError(f"Unknown backbone {backbone!r}; expected one of {BACKBONES}")


class EmbeddingNet(nn.Module):
    """A ResNet backbone and a projection head; the output is an L2-normalised embedding."""

    def __init__(self, backbone: str, embedding_dim: int, pretrained: bool = False):
        super().__init__()
        base = _resnet(backbone, pretrained)
        features = base.fc.in_features
        base.fc = nn.Identity()
        self.backbone = base
        self.head = nn.Sequential(nn.Linear(features, 512), nn.ReLU(inplace=True), nn.Linear(512, embedding_dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.head(self.backbone(x)), p=2, dim=1)


class _LegacyNet(nn.Module):
    """The layout of models trained before EMBEDDING_FORMAT (the classifier is only needed to load the file)."""

    def __init__(self, num_classes: int):
        super().__init__()
        base = models.resnet18(weights=None)
        features = base.fc.in_features
        base.fc = nn.Identity()
        self.backbone = base
        self.embedding_head = nn.Sequential(nn.Linear(features, 256), nn.ReLU(), nn.Dropout(0.4), nn.Linear(256, 256))
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.embedding_head(self.backbone(x)), p=2, dim=1)


def eval_transform(image_size: int, mean=IMAGENET_MEAN, std=IMAGENET_STD):
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])


def save_embedding_model(path: str, net: EmbeddingNet, *, backbone: str, embedding_dim: int, image_size: int,
                         thresholds: dict, classes: list, run_id: str) -> None:
    torch.save({
        "format": EMBEDDING_FORMAT,
        "backbone": backbone,
        "embedding_dim": int(embedding_dim),
        "image_size": int(image_size),
        "mean": list(IMAGENET_MEAN),
        "std": list(IMAGENET_STD),
        "thresholds": {"found": float(thresholds["found"]), "similar": float(thresholds["similar"])},
        "classes": [str(c) for c in classes],
        "run_id": str(run_id),
        "state_dict": {k: v.detach().cpu() for k, v in net.state_dict().items()},
    }, path)


@dataclass
class EmbeddingModel:
    net: nn.Module
    image_size: int
    mean: list
    std: list
    thresholds: dict
    meta: dict
    device: str = "cpu"
    transform: object = field(init=False, repr=False)

    def __post_init__(self):
        self.transform = eval_transform(self.image_size, self.mean, self.std)
        self.net.to(self.device).eval()

    def embed_many(self, images: list) -> np.ndarray:
        """RGB uint8 arrays (H, W, 3) → float32 unit vectors, one row each."""
        batch = torch.stack([self.transform(Image.fromarray(np.asarray(a, dtype=np.uint8))) for a in images])
        with torch.no_grad():
            out = self.net(batch.to(self.device)).cpu().numpy().astype(np.float32)
        return out / np.linalg.norm(out, axis=1, keepdims=True).clip(min=1e-12)

    def embed(self, rgb: np.ndarray) -> np.ndarray:
        return self.embed_many([rgb])[0]


def load_embedding_model(path: str, device: str = "cpu") -> EmbeddingModel:
    data = torch.load(path, map_location="cpu", weights_only=True)
    if isinstance(data, dict) and data.get("format") == EMBEDDING_FORMAT:
        net = EmbeddingNet(data["backbone"], data["embedding_dim"], pretrained=False)
        net.load_state_dict(data["state_dict"])
        meta = {k: v for k, v in data.items() if k != "state_dict"}
        return EmbeddingModel(net, data["image_size"], data["mean"], data["std"], dict(data["thresholds"]), meta, device)
    if isinstance(data, dict) and "classifier.weight" in data:
        net = _LegacyNet(int(data["classifier.weight"].shape[0]))
        net.load_state_dict(data)
        meta = {"format": "legacy", "backbone": "resnet18", "embedding_dim": 256, "image_size": 224,
                "classes": [], "run_id": None, "thresholds": dict(LEGACY_THRESHOLDS)}
        return EmbeddingModel(net, 224, list(IMAGENET_MEAN), list(IMAGENET_STD), dict(LEGACY_THRESHOLDS), meta, device)
    raise ValueError("Not a Coffer embedding model")


@dataclass
class DetectionModel:
    yolo: object
    imgsz: int
    confidence: float
    meta: dict

    def detect(self, rgb: np.ndarray) -> list:
        """Boxes (x1, y1, x2, y2, confidence) in an RGB image. Ultralytics reads NumPy arrays as BGR."""
        bgr = np.ascontiguousarray(np.asarray(rgb)[..., ::-1])
        result = self.yolo.predict(source=bgr, imgsz=self.imgsz, conf=self.confidence, verbose=False)[0]
        boxes = []
        for (x1, y1, x2, y2), conf in zip(result.boxes.xyxy.tolist(), result.boxes.conf.tolist()):
            boxes.append((int(x1), int(y1), int(x2), int(y2), float(conf)))
        return boxes

    def crops(self, rgb: np.ndarray) -> list:
        return [rgb[y1:y2, x1:x2] for x1, y1, x2, y2, _ in self.detect(rgb) if x2 > x1 and y2 > y1]


def _read_checkpoint(path: str) -> dict:
    # Ultralytics checkpoints pickle their model classes, so they need weights_only=False (as Ultralytics does).
    return torch.load(path, map_location="cpu", weights_only=False)


def load_detection_model(path: str, yolo_factory=None) -> DetectionModel:
    checkpoint = _read_checkpoint(path)
    coffer = checkpoint.get("coffer") if isinstance(checkpoint, dict) else None
    if coffer:
        meta = dict(coffer)
    else:
        train_args = (checkpoint.get("train_args") if isinstance(checkpoint, dict) else None) or {}
        meta = {"format": "legacy", "imgsz": int(train_args.get("imgsz") or 640), "confidence": LEGACY_CONFIDENCE, "run_id": None}
    if yolo_factory is None:
        from ultralytics import YOLO
        yolo_factory = YOLO
    return DetectionModel(yolo_factory(path), int(meta["imgsz"]), float(meta["confidence"]), meta)


def add_detection_metadata(path: str, *, imgsz: int, confidence: float, run_id: str) -> None:
    checkpoint = _read_checkpoint(path)
    checkpoint["coffer"] = {"format": DETECTION_FORMAT, "imgsz": int(imgsz), "confidence": float(confidence), "run_id": str(run_id)}
    torch.save(checkpoint, path)
