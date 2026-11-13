"""Security / consistency tests for the FastAPI service.

Run from Coffer.PythonService:  venv\\Scripts\\python.exe -m unittest discover -s tests
"""
import os
import sys
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402

import app as app_module  # noqa: E402


class FakeCollection:
    def __init__(self, fail=False):
        self.fail = fail
        self.deleted = []

    def delete(self, ids=None, where=None):
        if self.fail:
            raise RuntimeError("chroma unavailable")
        self.deleted.append(ids or where)

    def add(self, **kwargs):
        if self.fail:
            raise RuntimeError("chroma unavailable")


class AppSecurityTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("INTERNAL_API_KEY", None)
        self.collection = FakeCollection()
        app_module.app.state.collection = self.collection
        self.client = TestClient(app_module.app)  # no lifespan: the fake collection is used

    def tearDown(self):
        os.environ.pop("INTERNAL_API_KEY", None)

    # --- errors must not be reported as HTTP 200 (the backend commits its DB transaction on 2xx) ---

    def test_delete_embedding_failure_returns_server_error(self):
        self.collection.fail = True
        response = self.client.delete(f"/delete_embeddings/{uuid.uuid4()}")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["status"], "error")

    def test_delete_collection_embeddings_failure_returns_server_error(self):
        self.collection.fail = True
        response = self.client.delete(f"/delete_collection_embeddings/{uuid.uuid4()}")
        self.assertEqual(response.status_code, 500)

    def test_save_embeddings_failure_returns_server_error(self):
        with mock.patch.object(app_module, "save_embeddings_to_vectordb", side_effect=RuntimeError("boom")):
            response = self.client.post(
                f"/save_embeddings/{uuid.uuid4()}",
                json=[{"tempId": str(uuid.uuid4()), "id": str(uuid.uuid4())}],
            )
        self.assertEqual(response.status_code, 500)

    def test_successful_delete_still_returns_ok(self):
        item_id = str(uuid.uuid4())
        response = self.client.delete(f"/delete_embeddings/{item_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(self.collection.deleted, [[item_id]])

    # --- input validation (ids end up in file paths / vector DB filters) ---

    def test_image_check_rejects_non_numeric_collection_type(self):
        with mock.patch.object(app_module, "initialize_models") as init:
            response = self.client.post(
                f"/image_check/..%2E%2E/{uuid.uuid4()}",
                files={"file": ("a.jpg", b"123", "image/jpeg")},
            )
        self.assertIn(response.status_code, (400, 404, 422))
        init.assert_not_called()

    def test_image_check_rejects_non_uuid_collection_id(self):
        with mock.patch.object(app_module, "initialize_models") as init:
            response = self.client.post(
                "/image_check/1/not-a-uuid",
                files={"file": ("a.jpg", b"123", "image/jpeg")},
            )
        self.assertIn(response.status_code, (400, 422))
        init.assert_not_called()

    def test_delete_rejects_non_uuid_ids(self):
        response = self.client.delete("/delete_embeddings/not-a-uuid")
        self.assertIn(response.status_code, (400, 422))
        self.assertEqual(self.collection.deleted, [])

    # --- optional shared secret between backend and python service ---

    def test_requests_without_key_are_rejected_when_key_configured(self):
        os.environ["INTERNAL_API_KEY"] = "s3cret"
        response = self.client.delete(f"/delete_embeddings/{uuid.uuid4()}")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.collection.deleted, [])

    def test_requests_with_wrong_key_are_rejected(self):
        os.environ["INTERNAL_API_KEY"] = "s3cret"
        response = self.client.delete(f"/delete_embeddings/{uuid.uuid4()}", headers={"X-Internal-Api-Key": "nope"})
        self.assertEqual(response.status_code, 401)

    def test_requests_with_key_are_accepted(self):
        os.environ["INTERNAL_API_KEY"] = "s3cret"
        response = self.client.delete(f"/delete_embeddings/{uuid.uuid4()}", headers={"X-Internal-Api-Key": "s3cret"})
        self.assertEqual(response.status_code, 200)

    def test_no_key_configured_keeps_previous_behaviour(self):
        response = self.client.get("/hello")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
