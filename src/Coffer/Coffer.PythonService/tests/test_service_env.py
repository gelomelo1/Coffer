"""Running the AI service locally takes only its own settings from src/.env (Docker passes them via env_file)."""
import os
import tempfile
import unittest
from unittest import mock

import service_env


class ServiceEnvTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, ".env")
        # The backend's development seed is far longer than a Windows environment variable may be (32767).
        with open(self.path, "w", encoding="utf-8") as f:
            f.write("COFFER_ROOT_PATH=/from-file\nINTERNAL_API_KEY=k\nJWT_SECRET=not-for-the-ai-service\n")
            f.write("DEV_SEED_DATA_JSON='" + "x" * 50000 + "'\n")

    def test_loads_only_the_service_keys(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            service_env.load(self.path)
            self.assertEqual(os.environ.get("COFFER_ROOT_PATH"), "/from-file")
            self.assertEqual(os.environ.get("INTERNAL_API_KEY"), "k")
            self.assertNotIn("JWT_SECRET", os.environ)
            self.assertNotIn("DEV_SEED_DATA_JSON", os.environ)

    def test_existing_environment_wins(self):
        with mock.patch.dict(os.environ, {"COFFER_ROOT_PATH": "/from-docker"}, clear=True):
            service_env.load(self.path)
            self.assertEqual(os.environ["COFFER_ROOT_PATH"], "/from-docker")

    def test_missing_file_is_fine(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            service_env.load(os.path.join(self.dir, "nope.env"))
            self.assertNotIn("COFFER_ROOT_PATH", os.environ)


if __name__ == "__main__":
    unittest.main()
