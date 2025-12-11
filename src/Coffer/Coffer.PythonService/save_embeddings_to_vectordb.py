import os
import numpy as np
from pathlib import Path
from typing import List
from itemids import ItemIds
from vector_db_utils import save_item_to_vectordb



def save_embeddings_to_vectordb(
    collection,
    collectionId: str,
    path: str,
    items: List[ItemIds]
):
    base_path = Path(path)

    for item in items:
        npy_file = base_path / f"{item.temp_id}.npy"
        jpg_file = base_path / f"{item.temp_id}.jpg"

        if not npy_file.exists():
            print(f"Warning: embedding file not found: {npy_file}")
            continue

        embedding = np.load(npy_file)

        save_item_to_vectordb(
            collection,
            id=str(item.id),
            embedding=embedding,
            metadata=[("collection_id", collectionId)]
        )

        try:
            npy_file.unlink()
        except Exception as e:
            print(f"Failed to delete {npy_file}: {e}")

        if jpg_file.exists():
            try:
                jpg_file.unlink()
            except Exception as e:
                print(f"Failed to delete {jpg_file}: {e}")