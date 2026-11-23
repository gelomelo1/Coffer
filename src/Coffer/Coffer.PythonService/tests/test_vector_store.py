"""The vector collection uses cosine distance; an old squared-L2 collection is migrated once, keeping everything.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import sys
import unittest
import uuid

import chromadb
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from vector_store import open_cosine_collection, similarity_from_distance  # noqa: E402


def unit(v):
    v = np.asarray(v, dtype=np.float32)
    return (v / np.linalg.norm(v)).tolist()


class VectorStoreTests(unittest.TestCase):
    def setUp(self):
        self.client = chromadb.EphemeralClient()
        self.name = f"test-{uuid.uuid4().hex[:8]}"

    def tearDown(self):
        try:
            self.client.delete_collection(self.name)
        except Exception:
            pass

    def space(self, collection):
        return collection.configuration["hnsw"]["space"]

    def test_new_collection_is_cosine(self):
        self.assertEqual(self.space(open_cosine_collection(self.client, self.name)), "cosine")

    def test_migration_runs_once_and_keeps_everything(self):
        old = self.client.get_or_create_collection(self.name)
        self.assertEqual(self.space(old), "l2")
        vectors = [unit([1, 0, 0]), unit([1, 1, 0]), unit([0, 1, 1])]
        old.add(ids=["a", "b", "c"], embeddings=vectors,
                metadatas=[{"collection_id": "x"}, {"collection_id": "x"}, {"collection_id": "y"}])

        migrated = open_cosine_collection(self.client, self.name)
        again = open_cosine_collection(self.client, self.name)

        self.assertEqual(self.space(migrated), "cosine")
        self.assertEqual(self.space(again), "cosine")
        got = again.get(include=["embeddings", "metadatas"])
        by_id = {i: (e, m) for i, e, m in zip(got["ids"], got["embeddings"], got["metadatas"])}
        self.assertEqual(sorted(by_id), ["a", "b", "c"])
        for i, v in zip(["a", "b", "c"], vectors):
            np.testing.assert_allclose(by_id[i][0], v, atol=1e-6)
        self.assertEqual(by_id["c"][1], {"collection_id": "y"})

    def test_identical_vectors_have_similarity_one(self):
        c = open_cosine_collection(self.client, self.name)
        c.add(ids=["a"], embeddings=[unit([3, 4, 0])])
        d = c.query(query_embeddings=[unit([3, 4, 0])], n_results=1)["distances"][0][0]
        self.assertAlmostEqual(similarity_from_distance(d), 1.0, places=5)

    def test_orthogonal_vectors_have_similarity_zero(self):
        c = open_cosine_collection(self.client, self.name)
        c.add(ids=["a"], embeddings=[unit([1, 0, 0])])
        d = c.query(query_embeddings=[unit([0, 1, 0])], n_results=1)["distances"][0][0]
        self.assertAlmostEqual(similarity_from_distance(d), 0.0, places=5)


if __name__ == "__main__":
    unittest.main()
