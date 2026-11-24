"""A new embedding model goes live: every stored fingerprint of that item type is rebuilt from the item photos
(and waiting caps from their crops), so old-model vectors are never compared with new-model ones.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import shutil
import sys
import tempfile
import unittest
import uuid

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402

import app as app_module  # noqa: E402
import coffer_models as cm  # noqa: E402


class FakeCollection:
    def __init__(self):
        self.upserts = []

    def upsert(self, ids, embeddings, metadatas=None):
        self.upserts.append({"ids": list(ids), "embeddings": [list(e) for e in embeddings], "metadatas": metadatas})


class ReembedTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("INTERNAL_API_KEY", None)
        self.root = tempfile.mkdtemp()
        self.store = os.path.join(self.root, "data", "images")
        self.models = os.path.join(self.root, "models")
        os.makedirs(self.models)
        self.saved = {"COFFER_ROOT_PATH": os.environ.get("COFFER_ROOT_PATH")}
        os.environ["COFFER_ROOT_PATH"] = self.root
        os.makedirs(os.path.join(self.store, "items"))
        os.makedirs(os.path.join(self.store, "pending"))
        self.path = os.path.join(self.models, "5_similarity_2.pt")
        cm.save_embedding_model(self.path, cm.EmbeddingNet("resnet18", 256), backbone="resnet18", embedding_dim=256,
                                image_size=64, thresholds={"found": 0.9, "similar": 0.8}, classes=["a", "b"], run_id="r")
        self.collection = FakeCollection()
        app_module.app.state.collection = self.collection
        self.client = TestClient(app_module.app)

    def tearDown(self):
        for k, v in self.saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(self.root, ignore_errors=True)

    def image(self, folder, name, seed):
        rng = np.random.RandomState(seed)
        Image.fromarray(rng.randint(0, 255, (40, 40, 3), dtype=np.uint8)).save(os.path.join(self.store, folder, name))

    def test_reembed_upserts_items_and_rewrites_pending(self):
        item_a, item_b, waiting = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        coll = str(uuid.uuid4())
        self.image("items", "a.jpg", 1)
        self.image("items", "b.jpg", 2)
        self.image("pending", "w.jpg", 3)
        np.save(os.path.join(self.store, "pending", f"{waiting}.npy"), np.ones(256, np.float32))

        response = self.client.post("/reembed/5", json={
            "items": [{"id": item_a, "collectionId": coll, "image": "a.jpg"},
                      {"id": item_b, "collectionId": coll, "image": "b.jpg"},
                      {"id": str(uuid.uuid4()), "collectionId": coll, "image": "missing.jpg"}],
            "pending": [{"id": waiting, "image": "w.jpg"}],
        })

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "ok", "items": 2, "pending": 1, "missing": 1})
        upserted = [i for u in self.collection.upserts for i in u["ids"]]
        self.assertEqual(sorted(upserted), sorted([item_a, item_b]))
        self.assertEqual(self.collection.upserts[0]["metadatas"][0], {"collection_id": coll})
        model = cm.load_embedding_model(self.path)
        with Image.open(os.path.join(self.store, "pending", "w.jpg")) as img:
            expected = model.embed(np.asarray(img.convert("RGB")))
        np.testing.assert_allclose(np.load(os.path.join(self.store, "pending", f"{waiting}.npy")), expected, atol=1e-5)

    def test_reembed_never_reads_outside_the_store(self):
        secret = os.path.join(self.store, "secret.jpg")
        Image.fromarray(np.zeros((8, 8, 3), np.uint8)).save(secret)
        response = self.client.post("/reembed/5", json={
            "items": [{"id": str(uuid.uuid4()), "collectionId": str(uuid.uuid4()), "image": "../secret.jpg"}],
            "pending": []})
        self.assertEqual(response.json()["missing"], 1)
        self.assertEqual(self.collection.upserts, [])

    def test_reembed_without_a_model_is_an_error(self):
        response = self.client.post("/reembed/77", json={"items": [], "pending": []})
        self.assertEqual(response.status_code, 500)


if __name__ == "__main__":
    unittest.main()
