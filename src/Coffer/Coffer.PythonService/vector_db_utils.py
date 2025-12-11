from typing import List, Dict, Tuple
import numpy as np

def query_vectordb(
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

    where_filter = {k: v for k, v in metadata_filters} if metadata_filters else None

    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=top_n,
        where=where_filter
    )

    top_results = []
    for idx in range(len(results["ids"][0])): 
        top_results.append({
            "id": results["ids"][0][idx],
            "metadata": results["metadatas"][0][idx],
            "distance": results["distances"][0][idx]
        })

    return top_results

def save_item_to_vectordb(
    collection,
    id: str,
    embedding: np.ndarray,
    metadata: List[Tuple[str, str]] = []
):
    """
    Save an item to a ChromaDB collection.

    Args:
        collection: ChromaDB collection object.
        id (str): Unique ID for the item.
        embedding (np.ndarray): The vector embedding to store.
        metadata (List[Tuple[str, str]]): Optional list of key-value metadata pairs.
    """

    metadata_dict: Dict[str, str] = dict(metadata) if metadata else {}

    embedding_list = embedding.tolist() if isinstance(embedding, np.ndarray) else embedding

    collection.add(
        ids=[id],
        embeddings=[embedding_list],
        metadatas=[metadata_dict]
    )
