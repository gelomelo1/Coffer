"""Rebuilding fingerprints when an item type's embedding model changes: vectors of different models live in different
spaces and must never be compared. Items are re-embedded from their photo (IMAGESTORE_PATH/items — the same crop the
original fingerprint came from), waiting caps from their crop (IMAGESTORE_PATH/pending, stored as {id}.npy)."""
import os
import re
from typing import Dict, List

import numpy as np
from PIL import Image

SAFE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
BATCH = 32


def _read(folder: str, name: str):
    """The RGB photo `name` inside `folder`, or None when the name is unsafe or the file is missing."""
    if not SAFE_NAME.fullmatch(name or "") or ".." in name:
        return None
    path = os.path.join(folder, name)
    if not os.path.isfile(path):
        return None
    with Image.open(path) as img:
        return np.asarray(img.convert("RGB"))


def reembed(collection, model, image_store: str, items: List[Dict], pending: List[Dict]) -> Dict[str, int]:
    """items: [{"id", "collectionId", "image"}]; pending: [{"id", "image"}] (file names, not paths).
    Returns counts of rebuilt items and waiting caps, and of photos that were missing or not allowed."""
    items_folder = os.path.join(image_store, "items")
    pending_folder = os.path.join(image_store, "pending")
    done = {"items": 0, "pending": 0, "missing": 0}

    readable = []
    for item in items:
        rgb = _read(items_folder, item["image"])
        if rgb is None:
            done["missing"] += 1
        else:
            readable.append((item, rgb))
    for start in range(0, len(readable), BATCH):
        chunk = readable[start:start + BATCH]
        vectors = model.embed_many([rgb for _, rgb in chunk])
        collection.upsert(ids=[str(item["id"]) for item, _ in chunk],
                          embeddings=[v.tolist() for v in vectors],
                          metadatas=[{"collection_id": str(item["collectionId"])} for item, _ in chunk])
        done["items"] += len(chunk)

    for waiting in pending:
        rgb = _read(pending_folder, waiting["image"])
        if rgb is None:
            done["missing"] += 1
            continue
        np.save(os.path.join(pending_folder, f"{waiting['id']}.npy"), model.embed(rgb))
        done["pending"] += 1
    return done
