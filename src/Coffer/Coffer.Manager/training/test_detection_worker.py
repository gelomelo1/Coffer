"""Detection training end to end on tiny generated photos (CPU; YOLOv8n built from its yaml, so nothing is
downloaded): the worker checks the export, trains, evaluates on the test set and stamps the model.

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import json
import os
import shutil
import tempfile
import unittest

import numpy as np
import torch
from PIL import Image

from training import config, runs, worker
from training.detection_train import ultralytics_args, write_yolo_dataset


def yolo_export(root, count, start):
    """A Label Studio style YOLO export: a coloured disc per photo and its box."""
    os.makedirs(os.path.join(root, "images"), exist_ok=True)
    os.makedirs(os.path.join(root, "labels"), exist_ok=True)
    with open(os.path.join(root, "classes.txt"), "w") as f:
        f.write("cap\n")
    rng = np.random.RandomState(start)
    for i in range(count):
        img = np.clip(rng.randint(90, 160, (96, 96, 3)), 0, 255).astype(np.uint8)
        cx, cy, r = rng.randint(30, 66), rng.randint(30, 66), rng.randint(12, 22)
        yy, xx = np.mgrid[:96, :96]
        img[(yy - cy) ** 2 + (xx - cx) ** 2 < r * r] = rng.randint(0, 255, 3)
        stem = f"IMG202510{10 + i:02d}120000"
        Image.fromarray(img).save(os.path.join(root, "images", stem + ".jpg"))
        with open(os.path.join(root, "labels", stem + ".txt"), "w") as f:
            f.write(f"0 {cx / 96:.4f} {cy / 96:.4f} {2 * r / 96:.4f} {2 * r / 96:.4f}\n")
    return root


class DetectionWorkerTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(0)
        self.root = tempfile.mkdtemp()
        self.train_dir = yolo_export(os.path.join(self.root, "train"), 8, 1)
        self.test_dir = yolo_export(os.path.join(self.root, "test"), 3, 99)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def cfg(self, **overrides):
        values = dict(name="tiny-det", train_dir=self.train_dir, test_dir=self.test_dir, base_model="yolov8n.yaml",
                      epochs=1, imgsz=64, batch=4, patience=5)
        values.update(overrides)
        return config.DetectionConfig(**values)

    def test_ultralytics_args_maps_config(self):
        cfg = self.cfg(freeze=10, degrees=20.0, scale=0.4, translate=0.2, fliplr=0.3, mosaic=0.5, hsv_h=0.01,
                       hsv_s=0.6, hsv_v=0.3, lr0=0.005, seed=7)
        args = ultralytics_args(cfg, "data.yaml", self.root, "cpu")
        expected = {"data": "data.yaml", "epochs": 1, "imgsz": 64, "batch": 4, "patience": 5, "freeze": 10, "lr0": 0.005,
                    "degrees": 20.0, "scale": 0.4, "translate": 0.2, "fliplr": 0.3, "mosaic": 0.5, "hsv_h": 0.01,
                    "hsv_s": 0.6, "hsv_v": 0.3, "seed": 7, "project": self.root, "name": "yolo", "exist_ok": True,
                    "plots": False, "device": "cpu"}
        for key, value in expected.items():
            self.assertEqual(args[key], value, key)
        self.assertIsNone(ultralytics_args(self.cfg(freeze=0), "d", self.root, "cuda")["freeze"])
        self.assertEqual(ultralytics_args(self.cfg(), "d", self.root, "cuda")["device"], 0)

    def test_yolo_dataset_lists_absolute_paths(self):
        pairs = [(os.path.join(self.train_dir, "images", f), None) for f in sorted(os.listdir(os.path.join(self.train_dir, "images")))]
        yaml_path = write_yolo_dataset(self.root, pairs[:6], pairs[6:], "cap")
        with open(os.path.join(os.path.dirname(yaml_path), "train.txt")) as f:
            lines = f.read().split()
        self.assertEqual(len(lines), 6)
        self.assertTrue(all(os.path.isabs(line) for line in lines))
        self.assertIn("cap", open(yaml_path).read())

    def test_detection_worker_end_to_end(self):
        run_dir = runs.create_run(os.path.join(self.root, "runs"), self.cfg())
        worker.run(run_dir)

        progress = runs.read_progress(run_dir)
        self.assertEqual(progress["phase"], "done", progress)
        checkpoint = torch.load(os.path.join(run_dir, "detection.pt"), map_location="cpu", weights_only=False)
        self.assertEqual(checkpoint["coffer"]["imgsz"], 64)
        self.assertLessEqual(checkpoint["coffer"]["confidence"], 0.9)
        rep = json.load(open(os.path.join(run_dir, "report.json")))
        self.assertEqual(rep["test_size"], {"images": 3})
        self.assertIn("map50_95", rep["new"])
        self.assertTrue(os.path.exists(os.path.join(run_dir, "metrics.csv")))


if __name__ == "__main__":
    unittest.main()
