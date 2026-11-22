"""Model files per item type: "{id}_detection.pt" and "{id}_similarity_{classCount}.pt", matched exactly.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from file_utils import similarity_model_file  # noqa: E402


class SimilarityModelFileTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def touch(self, name):
        open(os.path.join(self.dir, name), "wb").close()

    def test_type_1_never_takes_type_11s_model(self):
        self.touch("11_similarity_40.pt")
        self.touch("1_similarity_60.pt")
        self.assertEqual(similarity_model_file(self.dir, 1), "1_similarity_60.pt")
        self.assertEqual(similarity_model_file(self.dir, 11), "11_similarity_40.pt")

    def test_missing_model_is_none(self):
        self.touch("21_similarity_5.pt")
        self.assertIsNone(similarity_model_file(self.dir, 1))
        self.assertIsNone(similarity_model_file(self.dir, 2))

    def test_unfinished_upload_is_ignored(self):
        self.touch("3_similarity_12.pt.uploading")
        self.assertIsNone(similarity_model_file(self.dir, 3))


if __name__ == "__main__":
    unittest.main()
