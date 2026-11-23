from typing import List, Dict, Tuple
import numpy as np

from save_temp_files import save_temp_files
from vector_db_utils import query_vectordb
from vector_store import similarity_from_distance

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    a_norm = a / np.linalg.norm(a)
    b_norm = b / np.linalg.norm(b)
    return float(np.dot(a_norm, b_norm))


def build_image_check_response(
    results: List[Dict],
    vector_db_collection,
    thresholds: Dict[str, float],
    save_path: str,
    metadata_filters: List[Tuple[str, str]] = []
) -> List[Dict]:
    """
    Build response for cropped image embeddings with local duplicate filtering 
    and vector DB similarity query.

    Args:
        results: List of dicts {"id": str, "image": np.ndarray, "embedding": np.ndarray}.
        vector_db_collection: ChromaDB collection object for similarity search.
        thresholds: {"found": cosine for 'found' (also merges crops of one photo), "similar": cosine for similars}.
        metadata_filters: Metadata filters to apply when querying the DB.

    Returns:
        List[Dict]: Response per item:
        {
            "id": str,
            "state": "found" | "not found",
            "quantity": int,
            "similars": List[str]
        }

        """

    main_threshold = thresholds["found"]
    secondary_threshold = thresholds["similar"]
    n = len(results)
    used_indices = set() 
    response = []

    for i in range(n):
        if i in used_indices:
            continue

        item_i = results[i]
        quantity = 1

        for j in range(i + 1, n):
            if j in used_indices:
                continue
            item_j = results[j]
            sim = cosine_similarity(item_i["embedding"], item_j["embedding"])

            if sim >= main_threshold:
                quantity += 1
                used_indices.add(j) 

        db_results = query_vectordb(
            vector_db_collection,
            item_i["embedding"],
            metadata_filters=metadata_filters,
            top_n=3
        )

        similars = [r["id"] for r in db_results if similarity_from_distance(r["distance"]) >= secondary_threshold]

        top_similarity = similarity_from_distance(db_results[0]["distance"]) if db_results else 0
        state = "found" if top_similarity >= main_threshold else "not found"

        save_temp_files(item_i, save_path)

        response.append({
            "id": item_i["id"],
            "state": state,
            "quantity": quantity,
            "similars": similars
        })

    return response