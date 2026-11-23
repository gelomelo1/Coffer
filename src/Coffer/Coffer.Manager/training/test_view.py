"""The Model training view (Tk, fake API, fake worker process) and the model download call.

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import os
import shutil
import sys
import tempfile
import tkinter as tk
import unittest
from unittest import mock

from reports.api import AdminApi
from training import config, runs
from training import view as view_module
from training.coffer_models import EmbeddingNet, LEGACY_THRESHOLDS, save_embedding_model


class FakeApi:
    def __init__(self):
        self.downloads = []
        self.uploads = []

    def item_types(self):
        return [{"id": 1, "name": "Caps"}, {"id": 2, "name": "Stamps"}]

    def download_model(self, type_id, kind, dest_path):
        self.downloads.append((type_id, kind, dest_path))
        with open(dest_path, "wb") as f:
            f.write(b"live")
        return True

    def upload_models(self, type_id, detection_path=None, embedding_path=None, class_count=None):
        self.uploads.append({"type_id": type_id, "detection_path": detection_path, "embedding_path": embedding_path,
                             "class_count": class_count})
        return {"id": type_id}


class FakeSession:
    def __init__(self):
        self._api = FakeApi()

    def api(self):
        return self._api

    def handle(self, error):
        return False


class FakeProcess:
    def __init__(self, args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.code = None

    def poll(self):
        return self.code

    def terminate(self):
        self.code = -1


class ViewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tk = tk.Tk()
        cls.tk.withdraw()

    @classmethod
    def tearDownClass(cls):
        cls.tk.destroy()

    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.launched = []

        def launcher(args, **kwargs):
            process = FakeProcess(args, **kwargs)
            self.launched.append(process)
            return process

        self.session = FakeSession()
        self.view = view_module.ModelTrainingView(self.tk, self.session, runs_root=self.root, launcher=launcher)

    def tearDown(self):
        self.view.destroy()
        shutil.rmtree(self.root, ignore_errors=True)

    def fill(self, kind, **values):
        form = self.view.forms[kind]
        form.vars["name"].set("Run one")
        form.vars["train_dir"].set(os.path.join(self.root, "train"))
        form.vars["test_dir"].set(os.path.join(self.root, "test"))
        for key, value in values.items():
            form.vars[key].set(value)

    def test_start_writes_run_and_launches_worker(self):
        self.fill("embedding", compare="1 · Caps")
        run_dir = self.view.start("embedding")

        self.assertEqual(len(self.launched), 1)
        self.assertEqual(self.launched[0].args, [sys.executable, "-m", "training.worker", run_dir])
        cfg = config.load(os.path.join(run_dir, "config.json"))
        self.assertEqual((cfg.kind, cfg.name, cfg.compare_type_id), ("embedding", "Run one", 1))
        self.assertEqual(self.session.api().downloads, [(1, "embedding", os.path.join(run_dir, "live_embedding.pt"))])

    def test_start_refuses_invalid_config(self):
        self.fill("embedding", hue="0.05")
        with mock.patch.object(view_module.messagebox, "showerror") as error:
            self.assertIsNone(self.view.start("embedding"))
        self.assertIn("0.02", error.call_args[0][1])
        self.assertEqual(self.launched, [])
        self.assertEqual(runs.list_runs(self.root), [])

    def test_unreadable_number_is_reported(self):
        self.fill("detection", epochs="lots")
        with mock.patch.object(view_module.messagebox, "showerror") as error:
            self.assertIsNone(self.view.start("detection"))
        self.assertIn("Epochs", error.call_args[0][1])

    def test_live_base_model_uses_the_downloaded_detector(self):
        self.fill("detection", compare="1 · Caps", base_model=view_module.LIVE_BASE)
        run_dir = self.view.start("detection")
        cfg = config.load(os.path.join(run_dir, "config.json"))
        self.assertEqual(cfg.base_model, os.path.join(run_dir, "live_detection.pt"))

    def test_stopped_run_offers_no_deploy(self):
        stopped = runs.create_run(self.root, config.EmbeddingConfig(name="s", train_dir="a", test_dir="b"))
        runs.write_progress(stopped, "stopped")
        done = runs.create_run(self.root, config.EmbeddingConfig(name="d", train_dir="a", test_dir="b"))
        runs.write_progress(done, "done")
        open(os.path.join(done, "embedding.pt"), "wb").close()

        self.assertFalse(self.view.can_deploy(stopped))
        self.assertTrue(self.view.can_deploy(done))
        self.view.refresh()
        self.view.select_run(stopped)
        self.assertEqual(str(self.view.deploy_button.cget("state")), "disabled")

    def test_stop_creates_the_stop_file(self):
        self.fill("embedding")
        run_dir = self.view.start("embedding")
        self.view.select_run(run_dir)
        self.view.stop_selected()
        self.assertTrue(os.path.exists(os.path.join(run_dir, "STOP")))

    def test_dead_worker_becomes_stopped(self):
        self.fill("embedding")
        run_dir = self.view.start("embedding")
        runs.write_progress(run_dir, "training", epoch=1, epochs=5)
        self.launched[0].code = 1
        self.view.poll_once()
        self.assertEqual(runs.read_progress(run_dir)["phase"], "stopped")

    def test_deploy_embedding_sends_class_count(self):
        done = runs.create_run(self.root, config.EmbeddingConfig(name="d", train_dir="a", test_dir="b"))
        runs.write_progress(done, "done")
        model = os.path.join(done, "embedding.pt")
        save_embedding_model(model, EmbeddingNet("resnet18", 16), backbone="resnet18", embedding_dim=16, image_size=64,
                             thresholds=LEGACY_THRESHOLDS, classes=["a", "b", "c"], run_id="r")
        with mock.patch.object(view_module.messagebox, "askyesno", return_value=True):
            self.assertTrue(self.view.deploy(done, 2))
        self.assertEqual(self.session.api().uploads,
                         [{"type_id": 2, "detection_path": None, "embedding_path": model, "class_count": 3}])


class FakeResponse:
    def __init__(self, status, content=b"", payload=None):
        self.status_code = status
        self.content = content
        self._payload = payload
        self.ok = 200 <= status < 300

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeHttp:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url))
        return self.response


class DownloadModelTests(unittest.TestCase):
    def test_download_model_route_and_404(self):
        folder = tempfile.mkdtemp()
        try:
            dest = os.path.join(folder, "live.pt")
            http = FakeHttp(FakeResponse(200, b"PK\x03\x04model"))
            self.assertTrue(AdminApi("http://x", "tok", session=http).download_model(3, "embedding", dest))
            self.assertEqual(http.calls, [("GET", "http://x/api/Admin/ItemTypes/3/Models/embedding")])
            self.assertEqual(open(dest, "rb").read(), b"PK\x03\x04model")

            missing = FakeHttp(FakeResponse(404, payload={"code": "modelNotFound", "message": "no"}))
            self.assertFalse(AdminApi("http://x", "tok", session=missing).download_model(3, "detection", dest + "2"))
            self.assertFalse(os.path.exists(dest + "2"))
        finally:
            shutil.rmtree(folder, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
