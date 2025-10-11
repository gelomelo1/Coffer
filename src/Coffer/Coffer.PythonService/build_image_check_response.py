from typing import List, Dict, Tuple
import numpy as np

from save_temp_files import save_temp_files
from vector_db_utils import query_chromadb

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    a_norm = a / np.linalg.norm(a)
    b_norm = b / np.linalg.norm(b)
    return float(np.dot(a_norm, b_norm))


def build_image_check_response(
    results: List[Dict],
    vector_db_collection,
    main_threshold,
    save_path: str,
    metadata_filters: List[Tuple[str, str]] = []
) -> List[Dict]:
    """
    Build response for cropped image embeddings with local duplicate filtering 
    and vector DB similarity query.

    Args:
        results: List of dicts {"id": str, "image": np.ndarray, "embedding": np.ndarray}.
        vector_db_collection: ChromaDB collection object for similarity search.
        main_threshold: Threshold to consider 'found'.
        secondary_threshold: Threshold to include in similars array.
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

    secondary_threshold = main_threshold - 0.1
    n = len(results)
    used_indices = set()  # indices already counted as duplicates
    response = []

    # Step 1: Local duplicate check
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
                used_indices.add(j)  # mark as duplicate

        # Step 2: Query vector DB for top 3 similar items
        db_results = query_chromadb(
            vector_db_collection,
            item_i["embedding"],
            metadata_filters=metadata_filters,
            top_n=3
        )

        # Only keep items with similarity >= secondary_threshold
        similars = [r["id"] for r in db_results if 1 - r["distance"] >= secondary_threshold]

        # Step 3: Determine state
        top_similarity = 1 - db_results[0]["distance"] if db_results else 0
        state = "found" if top_similarity >= main_threshold else "not found"

        save_temp_files(item_i, save_path)

        response.append({
            "id": item_i["id"],
            "state": state,
            "quantity": quantity,
            "similars": similars
        })

    return response