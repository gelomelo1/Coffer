"""Training core: settings, data checks, run folders, metrics and the report (no training, no window).

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import json
import os
import shutil
import tempfile
import unittest

import numpy as np
from PIL import Image

from training import config, datasets, metrics, report, runs

MANAGER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def image(path, seed):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    rng = np.random.RandomState(seed)
    Image.fromarray(rng.randint(0, 255, (16, 16, 3), dtype=np.uint8)).save(path)


class Folder(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def classes(self, name, spec, start=0):
        """spec: {class: image count}; every image has different content."""
        seed = start
        for cls, count in spec.items():
            for i in range(count):
                image(os.path.join(self.root, name, cls, f"IMG2025100917{i:02d}00.jpg"), seed)
                seed += 1
        return os.path.join(self.root, name)

    def yolo(self, name, count, classes_txt="cap\n", start=0, missing_label=None, empty_label=None):
        root = os.path.join(self.root, name)
        os.makedirs(os.path.join(root, "labels"), exist_ok=True)
        with open(os.path.join(root, "classes.txt"), "w") as f:
            f.write(classes_txt)
        for i in range(count):
            stem = f"IMG20251009{17 + i // 6:02d}{(i % 6) * 9:02d}00"
            image(os.path.join(root, "images", stem + ".jpg"), start + i)
            if i == missing_label:
                continue
            with open(os.path.join(root, "labels", stem + ".txt"), "w") as f:
                f.write("" if i == empty_label else "0 0.5 0.5 0.4 0.4\n")
        return root


class CofferModelsCopyTests(unittest.TestCase):
    def test_coffer_models_is_identical_to_the_service_copy(self):
        mine = os.path.join(MANAGER, "training", "coffer_models.py")
        service = os.path.join(MANAGER, "..", "Coffer.PythonService", "coffer_models.py")
        with open(mine, "rb") as a, open(service, "rb") as b:
            self.assertEqual(a.read().replace(b"\r\n", b"\n"), b.read().replace(b"\r\n", b"\n"))


class ConfigTests(Folder):
    def test_config_rejects_hue_above_002_and_bad_batch(self):
        cfg = config.EmbeddingConfig(name="run", train_dir="a", test_dir="b", hue=0.05, classes_per_batch=1)
        messages = " ".join(config.validate(cfg))
        self.assertIn("0.02", messages)
        self.assertIn("classes per batch", messages)
        self.assertEqual([], config.validate(config.EmbeddingConfig(name="run", train_dir="a", test_dir="b")))

    def test_embedding_size_must_match_the_vector_store(self):
        messages = " ".join(config.validate(config.EmbeddingConfig(name="r", train_dir="a", test_dir="b", embedding_dim=128)))
        self.assertIn("256", messages)

    def test_detection_image_size_must_be_multiple_of_32(self):
        self.assertTrue(config.validate(config.DetectionConfig(name="d", train_dir="a", test_dir="b", imgsz=600)))
        self.assertEqual([], config.validate(config.DetectionConfig(name="d", train_dir="a", test_dir="b")))

    def test_config_roundtrip(self):
        path = os.path.join(self.root, "config.json")
        cfg = config.EmbeddingConfig(name="r", train_dir="a", test_dir="b", compare_type_id=3, loss="subcenter_arcface")
        config.save(cfg, path)
        self.assertEqual(config.load(path), cfg)
        det = config.DetectionConfig(name="d", train_dir="a", test_dir="b", epochs=7)
        config.save(det, path)
        self.assertEqual(config.load(path), det)
        self.assertEqual(json.load(open(path))["kind"], "detection")


class EmbeddingDataTests(Folder):
    def test_valid_data_and_manifest(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 4})
        test = self.classes("test", {"t1": 3, "t2": 3}, start=100)
        data = datasets.check_embedding(train, test)
        self.assertEqual(sorted(data.train), ["c1", "c2", "c3", "c4", "c5"])
        self.assertEqual(len(data.manifest["train"]), 20)
        self.assertEqual(len(data.manifest["test"]), 6)
        self.assertEqual(len(data.manifest["test"][0]["sha1"]), 40)

    def test_embedding_test_overlap_by_content_is_refused(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 4})
        test = self.classes("test", {"t1": 3, "t2": 3}, start=100)
        shutil.copy(os.path.join(train, "c1", os.listdir(os.path.join(train, "c1"))[0]), os.path.join(test, "t1", "renamed.jpg"))
        with self.assertRaises(datasets.DatasetError) as e:
            datasets.check_embedding(train, test)
        self.assertIn("renamed.jpg", str(e.exception))

    def test_embedding_test_class_name_overlap_is_refused(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c4": 4, "c5": 4})
        test = self.classes("test", {"C1": 3, "t2": 3}, start=100)
        with self.assertRaises(datasets.DatasetError) as e:
            datasets.check_embedding(train, test)
        self.assertIn("C1", str(e.exception))

    def test_class_with_one_image_is_refused(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c5": 4, "c4": 1})
        test = self.classes("test", {"t1": 3, "t2": 3}, start=100)
        with self.assertRaises(datasets.DatasetError) as e:
            datasets.check_embedding(train, test)
        self.assertIn("c4", str(e.exception))

    def test_class_with_three_images_warns(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c5": 4, "c4": 3})
        test = self.classes("test", {"t1": 3, "t2": 3}, start=100)
        data = datasets.check_embedding(train, test)
        self.assertTrue(any("c4" in w for w in data.warnings))

    def test_four_training_caps_are_too_few(self):
        train = self.classes("train", {"c1": 4, "c2": 4, "c3": 4, "c4": 4})
        test = self.classes("test", {"t1": 3, "t2": 3}, start=100)
        with self.assertRaises(datasets.DatasetError) as e:
            datasets.check_embedding(train, test)
        self.assertIn("5", str(e.exception))

    def test_split_classes_keeps_two_for_validation(self):
        train, val = datasets.split_classes([f"c{i}" for i in range(6)], 0.15, seed=0)
        self.assertEqual((len(train), len(val)), (4, 2))

    def test_split_classes_is_seeded_and_disjoint(self):
        classes = [f"c{i}" for i in range(20)]
        train, val = datasets.split_classes(classes, 0.15, seed=1)
        self.assertEqual(len(val), 3)
        self.assertFalse(set(train) & set(val))
        self.assertEqual(datasets.split_classes(classes, 0.15, seed=1), (train, val))


class DetectionDataTests(Folder):
    def test_detection_requires_single_class_and_labels(self):
        test = self.yolo("test", 3, start=100)
        two = self.yolo("two", 6, classes_txt="cap\ncoin\n")
        with self.assertRaises(datasets.DatasetError):
            datasets.check_detection(two, test)
        missing = self.yolo("missing", 6, missing_label=2)
        with self.assertRaises(datasets.DatasetError) as e:
            datasets.check_detection(missing, test)
        self.assertIn("label", str(e.exception))
        background = self.yolo("bg", 6, empty_label=1, start=200)
        data = datasets.check_detection(background, test)
        self.assertEqual((len(data.train), len(data.test), data.class_name), (6, 3, "cap"))

    def test_detection_overlap_is_refused(self):
        train = self.yolo("train", 6)
        test = self.yolo("test", 3, start=0)  # same seeds → same bytes
        with self.assertRaises(datasets.DatasetError):
            datasets.check_detection(train, test)

    def test_one_long_session_still_leaves_training_photos(self):
        names = [f"IMG20251009{10 + i // 60:02d}{i % 60:02d}00.jpg" for i in range(100)]  # one sitting, shots a minute apart
        warnings = []
        train, val = datasets.split_by_session(names, 0.15, seed=0, warnings=warnings)
        self.assertEqual(len(train) + len(val), 100)
        self.assertTrue(8 <= len(val) <= 23, len(val))
        self.assertTrue(warnings)

    def test_few_large_sessions_do_not_swallow_training(self):
        names = ([f"IMG20251009{10 + i // 60:02d}{i % 60:02d}00.jpg" for i in range(50)]
                 + [f"IMG20251010{10 + i // 60:02d}{i % 60:02d}00.jpg" for i in range(10)]
                 + [f"IMG20251011{10 + i // 60:02d}{i % 60:02d}00.jpg" for i in range(30)])
        for seed in range(5):
            train, val = datasets.split_by_session(names, 0.15, seed=seed)
            self.assertTrue(1 <= len(val) <= 21, (seed, len(val)))

    def test_split_by_session_keeps_sessions_together(self):
        names = ["IMG20251009173435.jpg", "IMG20251009173456.jpg", "IMG20251010120000.jpg",
                 "IMG20251011120000.jpg", "IMG20251012120000.jpg", "other.jpg"]
        train, val = datasets.split_by_session(names, 0.3, seed=0)
        self.assertEqual(sorted(train + val), sorted(names))
        together = {"IMG20251009173435.jpg", "IMG20251009173456.jpg"}
        self.assertTrue(together <= set(train) or together <= set(val))
        self.assertTrue(val)


class MetricsTests(unittest.TestCase):
    def test_retrieval_metrics_known_case(self):
        perfect = np.array([[1, 0], [0.99, 0.141], [0, 1], [0.141, 0.99]], dtype=np.float32)
        m = metrics.retrieval_metrics(perfect, ["a", "a", "b", "b"])
        self.assertEqual((m["r1"], m["r5"], m["map_at_r"], m["queries"]), (1.0, 1.0, 1.0, 4))
        crossed = np.array([[1, 0], [0, 1], [0.99, 0.141], [0.141, 0.99]], dtype=np.float32)
        m = metrics.retrieval_metrics(crossed, ["a", "a", "b", "b"])
        self.assertEqual(m["r1"], 0.0)
        self.assertEqual(m["r5"], 1.0)

    def test_pair_scores(self):
        e = np.eye(3, dtype=np.float32)
        genuine, impostor = metrics.pair_scores(e, ["a", "a", "b"])
        self.assertEqual((len(genuine), len(impostor)), (1, 2))

    def test_top_impostor_is_the_closest_other_cap_per_query(self):
        e = np.array([[1, 0], [0.8, 0.6], [0, 1], [0.6, 0.8]], dtype=np.float32)
        top = metrics.top_impostor_scores(e, ["a", "a", "b", "b"])
        np.testing.assert_allclose(top, [0.6, 0.96, 0.6, 0.96], atol=1e-5)

    def test_found_threshold_limits_false_found_per_query(self):
        top = np.array([0.30] * 48 + [0.70, 0.95])
        rec = metrics.recommended_thresholds(np.array([0.99, 0.98, 0.9]), top)
        self.assertLessEqual(np.mean(top >= rec["found"]), 0.02)
        self.assertIn("false_found", rec)
        low = metrics.recommended_thresholds(np.array([0.9]), np.array([0.1] * 10))
        self.assertGreaterEqual(low["found"], metrics.MIN_FOUND)
        self.assertGreaterEqual(low["similar"], metrics.MIN_SIMILAR)

    def test_threshold_at_fmr(self):
        impostor = np.round(np.arange(0.1, 1.01, 0.1), 2)
        t = metrics.threshold_at_fmr(impostor, 0.1)
        self.assertLessEqual(np.mean(impostor >= t), 0.1)
        self.assertGreater(np.mean(impostor >= t), 0)
        rec = metrics.recommended_thresholds(np.array([0.95, 0.99]), impostor)
        self.assertLessEqual(rec["similar"], rec["found"])
        self.assertIn("found_recall", rec)

    def test_pick_confidence_capped_at_09(self):
        conf = np.linspace(0, 1, 101)
        f1 = 1 - np.abs(conf - 0.95)
        self.assertAlmostEqual(metrics.pick_confidence(conf, f1), 0.9, places=3)
        self.assertAlmostEqual(metrics.pick_confidence(conf, 1 - np.abs(conf - 0.4)), 0.4, places=3)

    def test_selection_breaks_recall_ties_with_map(self):
        from training.embedding_train import is_better
        best = {"r1": 1.0, "map_at_r": 0.80}
        self.assertTrue(is_better({"r1": 1.0, "map_at_r": 0.85}, best))
        self.assertFalse(is_better({"r1": 1.0, "map_at_r": 0.80}, best))
        self.assertFalse(is_better({"r1": 0.95, "map_at_r": 0.99}, best))
        self.assertTrue(is_better({"r1": 0.1, "map_at_r": 0.1}, None))

    def test_compare_marks_delta_and_missing_live(self):
        rows = metrics.compare({"r1": 0.9, "r5": 1.0}, {"r1": 0.8}, ["r1", "r5"])
        self.assertAlmostEqual(rows[0]["delta"], 0.1)
        self.assertIsNone(rows[1]["live"])
        self.assertIsNone(rows[1]["delta"])
        self.assertIsNone(metrics.compare({"r1": 0.9}, None, ["r1"])[0]["delta"])


class RunAndReportTests(Folder):
    def test_run_folder_and_progress(self):
        first = runs.create_run(self.root, config.EmbeddingConfig(name="First Try!", train_dir="a", test_dir="b"))
        second = runs.create_run(self.root, config.DetectionConfig(name="det", train_dir="a", test_dir="b"))
        self.assertIn("_embedding_first-try", os.path.basename(first))
        runs.write_progress(first, "training", epoch=2, epochs=10)
        self.assertEqual(runs.read_progress(first)["epoch"], 2)
        runs.log(first, "hello")
        self.assertIn("hello", open(os.path.join(first, "log.txt"), encoding="utf-8").read())
        listed = runs.list_runs(self.root)
        self.assertEqual([r["kind"] for r in listed], ["detection", "embedding"])
        self.assertEqual(listed[1]["phase"], "training")
        self.assertNotEqual(first, second)

    def test_report_compares_and_writes_markdown(self):
        run = runs.create_run(self.root, config.EmbeddingConfig(name="r", train_dir="a", test_dir="b"))
        rep = report.write_report(run, "embedding", {"r1": 0.88, "r5": 0.97, "r10": 1.0, "map_at_r": 0.7},
                                  {"r1": 0.81, "r5": 0.95, "r10": 0.99, "map_at_r": 0.6},
                                  {"classes": 5, "images": 30}, {"found": 0.9, "similar": 0.8})
        self.assertIn("+0.070", rep["headline"])
        md = open(os.path.join(run, "report.md"), encoding="utf-8").read()
        self.assertIn("0.810", md)
        self.assertIn("30", md)
        self.assertEqual(json.load(open(os.path.join(run, "report.json")))["headline"], rep["headline"])


if __name__ == "__main__":
    unittest.main()
