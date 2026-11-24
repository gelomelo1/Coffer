"""Waiting-for-review list: matching and saving from a stored (pending) fingerprint.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import shutil
import sys
import tempfile
import unittest
import uuid

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402

import app as app_module  # noqa: E402


class FakeCollection:
    """Answers every query with the configured (id, distance) pairs and records adds."""

    def __init__(self, matches=None, fail=False):
        self.matches = matches or []
        self.fail = fail
        self.added = []
        self.queries = []

    def query(self, query_embeddings, n_results, where=None):
        self.queries.append(where)
        ids = [m[0] for m in self.matches][:n_results]
        distances = [m[1] for m in self.matches][:n_results]
        return {"ids": [ids], "metadatas": [[{} for _ in ids]], "distances": [distances]}

    def add(self, **kwargs):
        if self.fail:
            raise RuntimeError("chroma unavailable")
        self.added.append(kwargs)


class PendingTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("INTERNAL_API_KEY", None)
        self.root = tempfile.mkdtemp()
        self.store = os.path.join(self.root, "data", "images")
        os.makedirs(os.path.join(self.store, "pending"))
        self.old_store = os.environ.get("COFFER_ROOT_PATH")
        os.environ["COFFER_ROOT_PATH"] = self.root
        self.collection_id = str(uuid.uuid4())

    def tearDown(self):
        if self.old_store is None:
            os.environ.pop("COFFER_ROOT_PATH", None)
        else:
            os.environ["COFFER_ROOT_PATH"] = self.old_store
        shutil.rmtree(self.root, ignore_errors=True)

    def client(self, collection):
        app_module.app.state.collection = collection
        return TestClient(app_module.app)

    def write_npy(self, pending_id):
        np.save(os.path.join(self.store, "pending", f"{pending_id}.npy"), np.ones(8, dtype=np.float32))

    def test_pending_similars_found_and_missing_file(self):
        stored, missing, match = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        self.write_npy(stored)
        collection = FakeCollection(matches=[(match, 0.02)])

        response = self.client(collection).post(f"/pending_similars/{self.collection_id}", json={"ids": [stored, missing]})

        self.assertEqual(response.status_code, 200)
        by_id = {r["id"]: r for r in response.json()["response"]}
        self.assertEqual(by_id[stored]["state"], "found")
        self.assertEqual(by_id[stored]["similars"], [match])
        self.assertEqual(by_id[missing], {"id": missing, "state": "not found", "similars": []})
        self.assertEqual(collection.queries, [{"collection_id": self.collection_id}])

    def test_pending_similars_use_the_given_thresholds(self):
        from pending import pending_similars
        stored, match = str(uuid.uuid4()), str(uuid.uuid4())
        self.write_npy(stored)
        folder = os.path.join(self.store, "pending")

        loose = pending_similars(FakeCollection(matches=[(match, 0.05)]), self.collection_id, folder, [stored],
                                 {"found": 0.9, "similar": 0.8})
        strict = pending_similars(FakeCollection(matches=[(match, 0.05)]), self.collection_id, folder, [stored],
                                  {"found": 0.99, "similar": 0.97})

        self.assertEqual((loose[0]["state"], loose[0]["similars"]), ("found", [match]))
        self.assertEqual((strict[0]["state"], strict[0]["similars"]), ("not found", []))

    def test_save_pending_embedding_adds_under_item_id(self):
        pending_id, item_id = str(uuid.uuid4()), str(uuid.uuid4())
        self.write_npy(pending_id)
        collection = FakeCollection()

        response = self.client(collection).post(f"/save_pending_embedding/{self.collection_id}", json={"pendingId": pending_id, "itemId": item_id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(collection.added), 1)
        self.assertEqual(collection.added[0]["ids"], [item_id])
        self.assertEqual(collection.added[0]["metadatas"], [{"collection_id": self.collection_id}])
        self.assertTrue(os.path.exists(os.path.join(self.store, "pending", f"{pending_id}.npy")))  # the backend deletes it

    def test_save_pending_embedding_missing_file_is_500(self):
        response = self.client(FakeCollection()).post(
            f"/save_pending_embedding/{self.collection_id}", json={"pendingId": str(uuid.uuid4()), "itemId": str(uuid.uuid4())})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["status"], "error")


if __name__ == "__main__":
    unittest.main()
