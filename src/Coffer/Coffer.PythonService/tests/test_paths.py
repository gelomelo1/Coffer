"""Every data folder comes from the single COFFER_ROOT_PATH."""
import os
import unittest
from unittest import mock

import paths


class PathsTest(unittest.TestCase):
    def test_derives_from_root(self):
        with mock.patch.dict(os.environ, {"COFFER_ROOT_PATH": "/x"}):
            self.assertEqual(paths.images(), os.path.join("/x", "data", "images"))
            self.assertEqual(paths.icons(), os.path.join("/x", "data", "icons"))
            self.assertEqual(paths.vectors(), os.path.join("/x", "data", "vectors"))
            self.assertEqual(paths.temp(), os.path.join("/x", "data", "temp"))
            self.assertEqual(paths.models(), os.path.join("/x", "models"))

    def test_missing_root_raises(self):
        env = {k: v for k, v in os.environ.items() if k != "COFFER_ROOT_PATH"}
        with mock.patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(RuntimeError, "COFFER_ROOT_PATH"):
                paths.images()

    def test_empty_root_raises(self):
        with mock.patch.dict(os.environ, {"COFFER_ROOT_PATH": "  "}):
            with self.assertRaisesRegex(RuntimeError, "COFFER_ROOT_PATH"):
                paths.models()


if __name__ == "__main__":
    unittest.main()
