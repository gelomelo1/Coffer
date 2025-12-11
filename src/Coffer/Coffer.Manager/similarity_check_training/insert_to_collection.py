
from pathlib import Path
from typing import Dict, List, Tuple
import chromadb
import numpy as np


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

def insert_to_collection(
        dest: str,
        name: str,
        embedding_file: str,
        id: str,
        metadata: str
):
    vector_db = chromadb.PersistentClient(dest)
    collection = vector_db.get_collection(name)

    embedding_path = Path(embedding_file)
    if not embedding_path.exists() or embedding_path.suffix.lower() != ".npy":
        raise ValueError(f"Embedding file does not exist or is not a .npy file: {embedding_file}")

    embedding = np.load(embedding_path)

    metadata_list: List[Tuple[str, str]] = []
    if metadata:
        for pair in metadata.split(","):
            if ":" in pair:
                key, value = pair.split(":", 1)
                metadata_list.append((key.strip(), value.strip()))

    save_item_to_vectordb(
        collection=collection,
        id=id,
        embedding=embedding,
        metadata=metadata_list
    )

    