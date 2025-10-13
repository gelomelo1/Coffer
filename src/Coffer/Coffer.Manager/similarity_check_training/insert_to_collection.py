
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

    # Convert metadata list of tuples to dict
    metadata_dict: Dict[str, str] = dict(metadata) if metadata else {}

    # ChromaDB expects embeddings as lists
    embedding_list = embedding.tolist() if isinstance(embedding, np.ndarray) else embedding

    # Add the item to the collection
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

    # Load embedding from .npy file
    embedding_path = Path(embedding_file)
    if not embedding_path.exists() or embedding_path.suffix.lower() != ".npy":
        raise ValueError(f"Embedding file does not exist or is not a .npy file: {embedding_file}")

    embedding = np.load(embedding_path)

    # Convert metadata string to list of tuples
    # Example: "key1:value1,key2:value2"
    metadata_list: List[Tuple[str, str]] = []
    if metadata:
        for pair in metadata.split(","):
            if ":" in pair:
                key, value = pair.split(":", 1)
                metadata_list.append((key.strip(), value.strip()))

    # Save to vector DB
    save_item_to_vectordb(
        collection=collection,
        id=id,
        embedding=embedding,
        metadata=metadata_list
    )

    