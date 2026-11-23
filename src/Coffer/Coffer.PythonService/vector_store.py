"""The item vector collection. Embeddings are L2-normalised, so cosine is the meaningful distance: Chroma's default
("l2", squared) made 1 - distance equal 2*cos - 1. An old l2 collection is migrated once on start-up."""

COSINE = {"hnsw": {"space": "cosine"}}
BATCH = 500


def _space(collection) -> str:
    return ((collection.configuration or {}).get("hnsw") or {}).get("space", "l2")


def open_cosine_collection(client, name: str):
    """The collection, with cosine distance. An existing l2 collection is copied into a cosine one: every id,
    vector and metadata is kept."""
    existing = [c.name if hasattr(c, "name") else c for c in client.list_collections()]
    if name not in existing:
        return client.create_collection(name, configuration=COSINE)
    collection = client.get_collection(name)
    if _space(collection) == "cosine":
        return collection

    data = collection.get(include=["embeddings", "metadatas"])
    ids, embeddings, metadatas = data["ids"], data["embeddings"], data["metadatas"]
    client.delete_collection(name)
    migrated = client.create_collection(name, configuration=COSINE)
    for start in range(0, len(ids), BATCH):
        end = start + BATCH
        metas = [m or None for m in metadatas[start:end]] if metadatas is not None else None
        migrated.add(ids=ids[start:end], embeddings=[list(map(float, e)) for e in embeddings[start:end]],
                     metadatas=metas if metas and any(metas) else None)
    return migrated


def similarity_from_distance(distance: float) -> float:
    """Cosine similarity from Chroma's cosine distance."""
    return 1.0 - float(distance)
