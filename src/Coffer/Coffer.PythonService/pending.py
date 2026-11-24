"""Waiting-for-review list: matching and saving from a fingerprint the backend stored under the image store (paths.images())/pending.

A detected cap may wait for days before its owner reviews it, so its matches are computed again, against the
collection as it is when the cap is opened (a duplicate added a minute ago is then offered as a match).
"""
import os
from typing import Dict, List

import numpy as np

import paths

from vector_db_utils import query_vectordb, save_item_to_vectordb
from vector_store import similarity_from_distance


def pending_folder() -> str:
    return os.path.join(paths.images(), "pending")


def pending_similars(collection, collection_id: str, base_path: str, ids: List[str], thresholds: Dict[str, float]) -> List[Dict]:
    """Same rules as build_image_check_response: top 3 of the collection, "found" at or above thresholds["found"]
    (cosine), similars at or above thresholds["similar"]. A missing fingerprint only affects its own entry."""
    response = []
    for pending_id in ids:
        path = os.path.join(base_path, f"{pending_id}.npy")
        if not os.path.exists(path):
            response.append({"id": pending_id, "state": "not found", "similars": []})
            continue
        embedding = np.load(path)
        results = query_vectordb(collection, embedding, metadata_filters=[("collection_id", collection_id)], top_n=3)
        similars = [r["id"] for r in results if similarity_from_distance(r["distance"]) >= thresholds["similar"]]
        top_similarity = similarity_from_distance(results[0]["distance"]) if results else 0
        response.append({
            "id": pending_id,
            "state": "found" if top_similarity >= thresholds["found"] else "not found",
            "similars": similars,
        })
    return response


def save_pending_embedding(collection, collection_id: str, base_path: str, pending_id: str, item_id: str) -> None:
    """Stores the waiting cap's fingerprint under the new item's id. The file stays; the backend deletes it."""
    path = os.path.join(base_path, f"{pending_id}.npy")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No stored fingerprint for pending item {pending_id}")
    save_item_to_vectordb(collection, id=item_id, embedding=np.load(path), metadata=[("collection_id", collection_id)])
