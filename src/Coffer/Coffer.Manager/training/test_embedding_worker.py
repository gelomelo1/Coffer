"""Embedding training end to end on tiny generated data (CPU, no pretrained weights): the worker checks the data,
trains, evaluates on the test set (and the live model), writes the model with its thresholds and the report.

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import csv
import json
import os
import shutil
import tempfile
import unittest

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from training import config, runs, worker
from training.coffer_models import EmbeddingNet, LEGACY_THRESHOLDS, load_embedding_model, save_embedding_model
from training.embedding_train import build_train_transform


def cap_image(path, colour, seed):
    """A coloured disc with a class-specific pattern and some noise: classes are learnable, images differ."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    rng = np.random.RandomState(seed)
    img = np.full((72, 72, 3), 230, dtype=np.uint8)
    yy, xx = np.mgrid[:72, :72]
    disc = (yy - 36) ** 2 + (xx - 36) ** 2 < 30 ** 2
    img[disc] = colour
    img[disc & ((xx // 8 + yy // 8) % 2 == 0)] = [255 - c for c in colour]
    img = np.clip(img.astype(int) + rng.randint(-20, 20, img.shape), 0, 255).astype(np.uint8)
    Image.fromarray(img).save(path)


class EmbeddingWorkerTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(0)
        self.root = tempfile.mkdtemp()
        rng = np.random.RandomState(42)
        self.train_dir = os.path.join(self.root, "train")
        self.test_dir = os.path.join(self.root, "test")
        seed = 0
        for c in range(8):
            colour = rng.randint(0, 255, 3).tolist()
            for i in range(4):
                cap_image(os.path.join(self.train_dir, f"cap{c:02d}", f"IMG2025100917{c:02d}{i:02d}.jpg"), colour, seed)
                seed += 1
        for c in range(3):
            colour = rng.randint(0, 255, 3).tolist()
            for i in range(3):
                cap_image(os.path.join(self.test_dir, f"new{c}", f"t{c}_{i}.jpg"), colour, seed)
                seed += 1
        self.runs_root = os.path.join(self.root, "runs")

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def cfg(self, **overrides):
        values = dict(name="tiny", train_dir=self.train_dir, test_dir=self.test_dir, pretrained=False, epochs=2,
                      image_size=64, embedding_dim=32, classes_per_batch=4, images_per_class=4, val_fraction=0.25,
                      frozen_stages=0, patience=50)
        values.update(overrides)
        return config.EmbeddingConfig(**values)

    def run_worker(self, cfg, live_model=None):
        run_dir = runs.create_run(self.runs_root, cfg)
        if live_model:
            shutil.copy(live_model, os.path.join(run_dir, "live_embedding.pt"))
        worker.run(run_dir)
        return run_dir

    def test_train_transform_has_no_flips_and_small_hue(self):
        pipeline = build_train_transform(self.cfg(hue=0.02)).transforms
        self.assertFalse(any(isinstance(t, (transforms.RandomHorizontalFlip, transforms.RandomVerticalFlip)) for t in pipeline))
        jitter = next(t for t in pipeline if isinstance(t, transforms.ColorJitter))
        self.assertLessEqual(max(abs(h) for h in (jitter.hue or (0, 0))), 0.02)

    def test_embedding_worker_end_to_end(self):
        run_dir = self.run_worker(self.cfg())

        progress = runs.read_progress(run_dir)
        self.assertEqual(progress["phase"], "done", progress)
        model = load_embedding_model(os.path.join(run_dir, "embedding.pt"))
        cfg_classes = sorted(os.listdir(self.train_dir))
        self.assertEqual(len(model.meta["classes"]), 6)  # 8 classes − 25% held out for validation
        self.assertTrue(set(model.meta["classes"]) < set(cfg_classes))
        self.assertEqual(set(model.thresholds), {"found", "similar"})
        self.assertNotEqual(model.thresholds, LEGACY_THRESHOLDS)
        rep = json.load(open(os.path.join(run_dir, "report.json")))
        self.assertIn("r1", rep["new"])
        self.assertIsNone(rep["live"])
        self.assertEqual(rep["test_size"], {"classes": 3, "images": 9})
        with open(os.path.join(run_dir, "metrics.csv")) as f:
            self.assertEqual(len(list(csv.DictReader(f))), 2)
        self.assertEqual(len(json.load(open(os.path.join(run_dir, "manifest.json")))["test"]), 9)

    def test_scheduler_anneals_per_epoch(self):
        run_dir = self.run_worker(self.cfg(epochs=3))
        with open(os.path.join(run_dir, "metrics.csv")) as f:
            lrs = [float(row["lr"]) for row in csv.DictReader(f)]
        self.assertEqual(len(lrs), 3)
        self.assertTrue(lrs[0] > lrs[1] > lrs[2], lrs)

    def test_worker_compares_with_live_model(self):
        live = os.path.join(self.root, "live.pt")
        save_embedding_model(live, EmbeddingNet("resnet18", 16, pretrained=False), backbone="resnet18", embedding_dim=16,
                             image_size=64, thresholds=LEGACY_THRESHOLDS, classes=["x", "y"], run_id="old")
        run_dir = self.run_worker(self.cfg(epochs=1), live_model=live)

        rep = json.load(open(os.path.join(run_dir, "report.json")))
        self.assertIsNotNone(rep["live"])
        r1 = next(r for r in rep["rows"] if r["metric"] == "r1")
        self.assertAlmostEqual(r1["delta"], r1["new"] - r1["live"])

    def test_overlapping_test_set_fails_in_checking(self):
        some = os.path.join(self.train_dir, "cap00", sorted(os.listdir(os.path.join(self.train_dir, "cap00")))[0])
        shutil.copy(some, os.path.join(self.test_dir, "new0", "copy.jpg"))
        run_dir = self.run_worker(self.cfg())

        progress = runs.read_progress(run_dir)
        self.assertEqual(progress["phase"], "failed")
        self.assertIn("copy.jpg", progress["message"])
        self.assertFalse(os.path.exists(os.path.join(run_dir, "embedding.pt")))

    def test_stop_file_stops_the_run(self):
        run_dir = runs.create_run(self.runs_root, self.cfg(epochs=5))
        open(os.path.join(run_dir, "STOP"), "w").close()
        worker.run(run_dir)

        self.assertEqual(runs.read_progress(run_dir)["phase"], "stopped")
        self.assertFalse(os.path.exists(os.path.join(run_dir, "embedding.pt")))


if __name__ == "__main__":
    unittest.main()
