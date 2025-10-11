from typing import List, Dict, Tuple
import numpy as np

def query_chromadb(
    collection,
    query_embedding: np.ndarray,
    metadata_filters: List[Tuple[str, str]] = [],
    top_n: int = 3
) -> List[Dict]:
    """
    Query ChromaDB for closest results to an embedding, filtered by metadata.

    Args:
        collection: ChromaDB collection object.
        query_embedding (np.ndarray): The embedding to search with.
        metadata_filters (List[Tuple[str, str]]): List of (field, value) filters for metadata.
        top_n (int): Number of top results to return.

    Returns:
        List[Dict]: List of top results, each with 'id', 'metadata', and 'distance' fields.
    """

    # Convert list of tuples into a dict for ChromaDB
    where_filter = {k: v for k, v in metadata_filters} if metadata_filters else None

    # Query ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=top_n,
        where=where_filter
    )

    # Format results
    top_results = []
    for idx in range(len(results["ids"][0])):  # results["ids"] is nested
        top_results.append({
            "id": results["ids"][0][idx],
            "metadata": results["metadatas"][0][idx],
            "distance": results["distances"][0][idx]
        })

    return top_results