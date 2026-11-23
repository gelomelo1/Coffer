"""Self-describing model files, the model cache and the validate endpoint.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import shutil
import sys
import tempfile
import time
import unittest

import numpy as np
import torch
from torch import nn

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import coffer_models as cm  # noqa: E402
from model_cache import ModelCache  # noqa: E402


class LegacyNet(nn.Module):
    """The layout of the models trained before the self-describing format (raw state dict)."""

    def __init__(self, num_classes):
        super().__init__()
        from torchvision import models
        base = models.resnet18(weights=None)
        feats = base.fc.in_features
        base.fc = nn.Identity()
        self.backbone = base
        self.embedding_head = nn.Sequential(nn.Linear(feats, 256), nn.ReLU(), nn.Dropout(0.4), nn.Linear(256, 256))
        self.classifier = nn.Linear(256, num_classes)


class FakeBoxes:
    def __init__(self):
        self.xyxy = torch.zeros((0, 4))
        self.conf = torch.zeros((0,))

    def __len__(self):
        return 0


class FakeResult:
    boxes = FakeBoxes()


class FakeYolo:
    def __init__(self, path=None):
        self.path = path
        self.calls = []

    def predict(self, **kwargs):
        self.calls.append(kwargs)
        return [FakeResult()]


class CofferModelTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def path(self, name):
        return os.path.join(self.dir, name)

    def save_new(self, name="e.pt", backbone="resnet18", dim=32, size=96):
        torch.manual_seed(0)
        net = cm.EmbeddingNet(backbone, dim, pretrained=False).eval()
        cm.save_embedding_model(self.path(name), net, backbone=backbone, embedding_dim=dim, image_size=size,
                                thresholds={"found": 0.91, "similar": 0.83}, classes=["a", "b"], run_id="run-1")
        return net

    def test_new_embedding_roundtrip(self):
        net = self.save_new()
        model = cm.load_embedding_model(self.path("e.pt"))
        self.assertEqual(model.meta["format"], cm.EMBEDDING_FORMAT)
        self.assertEqual(model.image_size, 96)
        self.assertEqual(model.thresholds, {"found": 0.91, "similar": 0.83})
        self.assertEqual(model.meta["classes"], ["a", "b"])
        rgb = (np.random.RandomState(1).rand(50, 40, 3) * 255).astype(np.uint8)
        vector = model.embed(rgb)
        self.assertEqual(vector.shape, (32,))
        self.assertAlmostEqual(float(np.linalg.norm(vector)), 1.0, places=5)
        with torch.no_grad():
            expected = net(model.transform(cm.Image.fromarray(rgb)).unsqueeze(0))[0].numpy()
        np.testing.assert_allclose(vector, expected, atol=1e-5)

    def test_legacy_embedding_loads_with_legacy_thresholds(self):
        torch.save(LegacyNet(60).state_dict(), self.path("1_similarity_60.pt"))
        model = cm.load_embedding_model(self.path("1_similarity_60.pt"))
        self.assertEqual(model.thresholds, cm.LEGACY_THRESHOLDS)
        self.assertEqual(model.image_size, 224)
        self.assertEqual(model.embed(np.zeros((30, 30, 3), np.uint8)).shape, (256,))

    def test_resnet50_model_loads(self):
        self.save_new("r50.pt", backbone="resnet50", dim=16, size=64)
        self.assertEqual(cm.load_embedding_model(self.path("r50.pt")).embed(np.zeros((20, 20, 3), np.uint8)).shape, (16,))

    def test_detection_receives_bgr(self):
        fake = FakeYolo()
        model = cm.DetectionModel(fake, imgsz=320, confidence=0.4, meta={})
        rgb = np.zeros((10, 10, 3), np.uint8)
        rgb[..., 0] = 200  # red
        model.detect(rgb)
        call = fake.calls[0]
        self.assertEqual(call["source"][0, 0].tolist(), [0, 0, 200])
        self.assertEqual((call["imgsz"], call["conf"]), (320, 0.4))

    def test_legacy_detection_reads_train_imgsz(self):
        torch.save({"train_args": {"imgsz": 640}, "model": None}, self.path("1_detection.pt"))
        model = cm.load_detection_model(self.path("1_detection.pt"), yolo_factory=FakeYolo)
        self.assertEqual((model.imgsz, model.confidence), (640, cm.LEGACY_CONFIDENCE))

    def test_detection_metadata_is_read(self):
        torch.save({"train_args": {"imgsz": 640}, "model": None}, self.path("d.pt"))
        cm.add_detection_metadata(self.path("d.pt"), imgsz=512, confidence=0.45, run_id="r")
        model = cm.load_detection_model(self.path("d.pt"), yolo_factory=FakeYolo)
        self.assertEqual((model.imgsz, model.confidence, model.meta["format"]), (512, 0.45, cm.DETECTION_FORMAT))

    def test_detection_candidate_file_loads(self):
        """Uploads are validated as "{id}_detection.pt.candidate"; Ultralytics only opens names ending in .pt."""
        from ultralytics import YOLO
        YOLO("yolov8n.yaml").save(self.path("d.pt"))
        os.replace(self.path("d.pt"), self.path("7_detection.pt.candidate"))
        model = cm.load_detection_model(self.path("7_detection.pt.candidate"))
        self.assertEqual(model.detect(np.zeros((64, 64, 3), np.uint8)), [])
        self.assertEqual(os.listdir(self.dir), ["7_detection.pt.candidate"])

    def test_cache_reuses_until_file_changes(self):
        loads = []
        cache = ModelCache(loaders={"embedding": lambda p: loads.append(p) or object(), "detection": lambda p: object()})
        file = self.path("x.pt")
        open(file, "wb").write(b"1")
        first = cache.embedding(file)
        self.assertIs(cache.embedding(file), first)
        later = time.time() + 5
        os.utime(file, (later, later))
        cache.embedding(file)
        self.assertEqual(len(loads), 2)


class ValidateEndpointTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("INTERNAL_API_KEY", None)
        self.dir = tempfile.mkdtemp()
        self.old = os.environ.get("MODELS_PATH")
        os.environ["MODELS_PATH"] = self.dir
        from fastapi.testclient import TestClient
        import app as app_module
        self.client = TestClient(app_module.app)

    def tearDown(self):
        if self.old is None:
            os.environ.pop("MODELS_PATH", None)
        else:
            os.environ["MODELS_PATH"] = self.old
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_validate_accepts_good_and_rejects_bad(self):
        net = cm.EmbeddingNet("resnet18", 256, pretrained=False)
        cm.save_embedding_model(os.path.join(self.dir, "5_similarity_2.pt.candidate"), net, backbone="resnet18",
                                embedding_dim=256, image_size=64, thresholds=cm.LEGACY_THRESHOLDS, classes=["a", "b"], run_id="r")
        open(os.path.join(self.dir, "6_similarity_2.pt"), "wb").write(os.urandom(200))

        good = self.client.post("/models/validate", json={"fileName": "5_similarity_2.pt.candidate", "kind": "embedding"})
        bad = self.client.post("/models/validate", json={"fileName": "6_similarity_2.pt", "kind": "embedding"})
        escape = self.client.post("/models/validate", json={"fileName": "../x.pt", "kind": "embedding"})
        wrong_kind = self.client.post("/models/validate", json={"fileName": "5_similarity_2.pt.candidate", "kind": "detection"})

        self.assertEqual(good.status_code, 200, good.text)
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(escape.status_code, 422)
        self.assertEqual(wrong_kind.status_code, 422)

    def test_validate_rejects_a_different_embedding_size(self):
        """Every item type shares one vector store of 256-number fingerprints."""
        cm.save_embedding_model(os.path.join(self.dir, "5_similarity_2.pt.candidate"), cm.EmbeddingNet("resnet18", 32),
                                backbone="resnet18", embedding_dim=32, image_size=64, thresholds=cm.LEGACY_THRESHOLDS,
                                classes=["a", "b"], run_id="r")
        response = self.client.post("/models/validate", json={"fileName": "5_similarity_2.pt.candidate", "kind": "embedding"})
        self.assertEqual(response.status_code, 422)
        self.assertIn("256", response.json()["message"])


if __name__ == "__main__":
    unittest.main()
