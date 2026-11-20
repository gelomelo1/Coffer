"""Waiting-for-review list: matching and saving from a fingerprint the backend stored under IMAGESTORE_PATH/pending.

A detected cap may wait for days before its owner reviews it, so its matches are computed again, against the
collection as it is when the cap is opened (a duplicate added a minute ago is then offered as a match).
"""
import os
from typing import Dict, List

import numpy as np

from config import SIMILARITY_THRESHOLD
from vector_db_utils import query_vectordb, save_item_to_vectordb


def pending_folder() -> str:
    return os.path.join(os.getenv("IMAGESTORE_PATH", ""), "pending")


def pending_similars(collection, collection_id: str, base_path: str, ids: List[str]) -> List[Dict]:
    """Same rules as build_image_check_response: top 3 of the collection, "found" above the main threshold,
    similars above main - 0.1. A missing fingerprint only affects its own entry."""
    secondary_threshold = SIMILARITY_THRESHOLD - 0.1
    response = []
    for pending_id in ids:
        path = os.path.join(base_path, f"{pending_id}.npy")
        if not os.path.exists(path):
            response.append({"id": pending_id, "state": "not found", "similars": []})
            continue
        embedding = np.load(path)
        results = query_vectordb(collection, embedding, metadata_filters=[("collection_id", collection_id)], top_n=3)
        similars = [r["id"] for r in results if 1 - r["distance"] >= secondary_threshold]
        top_similarity = 1 - results[0]["distance"] if results else 0
        response.append({
            "id": pending_id,
            "state": "found" if top_similarity >= SIMILARITY_THRESHOLD else "not found",
            "similars": similars,
        })
    return response


def save_pending_embedding(collection, collection_id: str, base_path: str, pending_id: str, item_id: str) -> None:
    """Stores the waiting cap's fingerprint under the new item's id. The file stays; the backend deletes it."""
    path = os.path.join(base_path, f"{pending_id}.npy")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No stored fingerprint for pending item {pending_id}")
    save_item_to_vectordb(collection, id=item_id, embedding=np.load(path), metadata=[("collection_id", collection_id)])
