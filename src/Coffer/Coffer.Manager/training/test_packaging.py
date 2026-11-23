"""Coffer.Manager as a packaged executable: workers start through the executable itself, settings live next to it,
and a self-test proves the bundle can import and run everything training needs.

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

import app
from reports import session
from training import view as view_module


class PackagingTests(unittest.TestCase):
    def test_worker_command_from_source_uses_the_module(self):
        with mock.patch.object(sys, "frozen", False, create=True):
            self.assertEqual(view_module.worker_command("R"), [sys.executable, "-m", "training.worker", "R"])

    def test_worker_command_when_packaged_uses_the_executable(self):
        with mock.patch.object(sys, "frozen", True, create=True), mock.patch.object(sys, "executable", r"C:\Apps\Coffer.Manager\Coffer.Manager.exe"):
            self.assertEqual(view_module.worker_command("R"), [r"C:\Apps\Coffer.Manager\Coffer.Manager.exe", "--train-worker", "R"])

    def test_env_file_sits_next_to_the_executable_when_packaged(self):
        with mock.patch.object(sys, "frozen", True, create=True), mock.patch.object(sys, "executable", r"C:\Apps\Coffer.Manager\Coffer.Manager.exe"):
            self.assertEqual(session.env_file(), Path(r"C:\Apps\Coffer.Manager\.env"))
        with mock.patch.object(sys, "frozen", False, create=True):
            self.assertEqual(session.env_file(), Path(session.__file__).resolve().parent.parent / ".env")

    def test_train_worker_switch_runs_the_worker(self):
        with mock.patch("training.worker.run") as run:
            self.assertEqual(app.main(["Coffer.Manager.exe", "--train-worker", "C:/runs/x"]), 0)
        run.assert_called_once_with("C:/runs/x")

    def test_self_test_imports_and_runs_the_training_stack(self):
        self.assertEqual(app.main(["Coffer.Manager.exe", "--self-test"]), 0)


if __name__ == "__main__":
    unittest.main()
