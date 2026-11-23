"""Training settings of one run (saved as config.json in the run folder). Defaults follow the research report
(docs/research/2026-11-23-ai-finetuning-analysis.md)."""
import json
from dataclasses import asdict, dataclass, fields
from typing import Optional

from training.coffer_models import BACKBONES

LOSSES = ("triplet", "subcenter_arcface")


@dataclass
class DetectionConfig:
    name: str
    train_dir: str
    test_dir: str
    compare_type_id: Optional[int] = None
    base_model: str = "yolov8n.pt"
    epochs: int = 100
    imgsz: int = 640
    batch: int = 16
    patience: int = 30
    freeze: int = 0
    lr0: float = 0.01
    degrees: float = 15.0
    scale: float = 0.5
    translate: float = 0.1
    fliplr: float = 0.5
    mosaic: float = 1.0
    hsv_h: float = 0.015
    hsv_s: float = 0.7
    hsv_v: float = 0.4
    val_fraction: float = 0.15
    seed: int = 0

    kind = "detection"


@dataclass
class EmbeddingConfig:
    name: str
    train_dir: str
    test_dir: str
    compare_type_id: Optional[int] = None
    backbone: str = "resnet18"
    pretrained: bool = True
    embedding_dim: int = 256
    image_size: int = 224
    frozen_stages: int = 2
    epochs: int = 40
    classes_per_batch: int = 8
    images_per_class: int = 4
    lr: float = 3e-4
    loss: str = "triplet"
    val_fraction: float = 0.15
    patience: int = 8
    perspective: float = 0.2
    brightness: float = 0.3
    contrast: float = 0.3
    saturation: float = 0.2
    hue: float = 0.0
    blur_p: float = 0.2
    erasing_p: float = 0.25
    seed: int = 0

    kind = "embedding"


def _range(errors, label, value, low, high):
    if value is None or not (low <= value <= high):
        errors.append(f"{label} must be between {low} and {high}.")


def validate(cfg) -> list:
    """Human-readable problems with the settings; empty when they can be used."""
    errors = []
    if not (cfg.name or "").strip() or len(cfg.name) > 60:
        errors.append("The run needs a name of at most 60 characters.")
    if not (cfg.train_dir or "").strip():
        errors.append("Choose the training data folder.")
    if not (cfg.test_dir or "").strip():
        errors.append("Choose the test set folder (it is required).")
    elif (cfg.train_dir or "").strip() and cfg.train_dir.strip() == cfg.test_dir.strip():
        errors.append("The test set must be a different folder from the training data.")
    _range(errors, "Validation share", cfg.val_fraction, 0.05, 0.5)

    if isinstance(cfg, EmbeddingConfig):
        if cfg.backbone not in BACKBONES:
            errors.append(f"Backbone must be one of {', '.join(BACKBONES)}.")
        if cfg.loss not in LOSSES:
            errors.append(f"Loss must be one of {', '.join(LOSSES)}.")
        _range(errors, "Embedding size", cfg.embedding_dim, 32, 2048)
        _range(errors, "Image size", cfg.image_size, 64, 512)
        _range(errors, "Frozen stages", cfg.frozen_stages, 0, 4)
        _range(errors, "Epochs", cfg.epochs, 1, 500)
        if cfg.classes_per_batch is None or cfg.classes_per_batch < 2:
            errors.append("At least 2 classes per batch are needed (triplets need other caps).")
        if cfg.images_per_class is None or cfg.images_per_class < 2:
            errors.append("At least 2 images per class are needed in a batch.")
        _range(errors, "Learning rate", cfg.lr, 1e-6, 0.1)
        _range(errors, "Patience", cfg.patience, 1, 500)
        _range(errors, "Perspective", cfg.perspective, 0.0, 0.5)
        for label, value in (("Brightness", cfg.brightness), ("Contrast", cfg.contrast), ("Saturation", cfg.saturation),
                             ("Blur probability", cfg.blur_p), ("Erasing probability", cfg.erasing_p)):
            _range(errors, label, value, 0.0, 1.0)
        if cfg.hue is None or not (0.0 <= cfg.hue <= 0.02):
            errors.append("Hue shift can be at most 0.02: colour is part of a cap's identity.")
    else:
        _range(errors, "Epochs", cfg.epochs, 1, 1000)
        if cfg.imgsz is None or cfg.imgsz % 32 or not (64 <= cfg.imgsz <= 1280):
            errors.append("Image size must be a multiple of 32 between 64 and 1280.")
        _range(errors, "Batch", cfg.batch, 1, 256)
        _range(errors, "Patience", cfg.patience, 1, 1000)
        _range(errors, "Frozen layers", cfg.freeze, 0, 23)
        _range(errors, "Learning rate", cfg.lr0, 1e-6, 1.0)
        _range(errors, "Rotation (degrees)", cfg.degrees, 0.0, 180.0)
        for label, value in (("Scale", cfg.scale), ("Translate", cfg.translate)):
            _range(errors, label, value, 0.0, 0.9)
        for label, value in (("Horizontal flip", cfg.fliplr), ("Mosaic", cfg.mosaic), ("HSV hue", cfg.hsv_h),
                             ("HSV saturation", cfg.hsv_s), ("HSV value", cfg.hsv_v)):
            _range(errors, label, value, 0.0, 1.0)
        if not (cfg.base_model or "").strip():
            errors.append("Choose a base model.")
    return errors


def save(cfg, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"kind": cfg.kind, **asdict(cfg)}, f, indent=2)


def load(path: str):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    cls = DetectionConfig if data.pop("kind") == "detection" else EmbeddingConfig
    known = {f.name for f in fields(cls)}
    return cls(**{k: v for k, v in data.items() if k in known})
