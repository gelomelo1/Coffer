"""The item vector collection. Embeddings are L2-normalised, so cosine is the meaningful distance: Chroma's default
("l2", squared) made 1 - distance equal 2*cos - 1. An old l2 collection is migrated once on start-up.

The migration never leaves the fingerprints in memory only: they are copied into "<name>_cosine", the copy is
counted against the original, and only then is the original deleted and the copy renamed. A crash at any point
leaves either the intact original (the copy is redone) or the checked copy (the rename is finished)."""

COSINE = {"hnsw": {"space": "cosine"}}
BATCH = 500
COPY_SUFFIX = "_cosine"


def _space(collection) -> str:
    return ((collection.configuration or {}).get("hnsw") or {}).get("space", "l2")


def _names(client) -> list:
    return [c.name if hasattr(c, "name") else c for c in client.list_collections()]


def open_cosine_collection(client, name: str):
    """The collection, with cosine distance; every id, vector and metadata of an older l2 collection is kept."""
    copy_name = name + COPY_SUFFIX
    names = _names(client)
    if name not in names:
        if copy_name in names:  # crashed after deleting the original: the copy was already checked
            copy = client.get_collection(copy_name)
            copy.modify(name=name)
            return client.get_collection(name)
        return client.create_collection(name, configuration=COSINE)

    original = client.get_collection(name)
    if _space(original) == "cosine":
        if copy_name in names:
            client.delete_collection(copy_name)
        return original

    if copy_name in names:  # crashed while copying: start the copy again from the intact original
        client.delete_collection(copy_name)
    data = original.get(include=["embeddings", "metadatas"])
    ids, embeddings, metadatas = data["ids"], data["embeddings"], data["metadatas"]
    copy = client.create_collection(copy_name, configuration=COSINE)
    for start in range(0, len(ids), BATCH):
        end = start + BATCH
        metas = [m or None for m in metadatas[start:end]] if metadatas is not None else None
        copy.add(ids=ids[start:end], embeddings=[list(map(float, e)) for e in embeddings[start:end]],
                 metadatas=metas if metas and any(metas) else None)
    if copy.count() != len(ids):
        raise RuntimeError(f"Vector migration copied {copy.count()} of {len(ids)} fingerprints; the original is kept.")
    client.delete_collection(name)
    copy.modify(name=name)
    return client.get_collection(name)


def similarity_from_distance(distance: float) -> float:
    """Cosine similarity from Chroma's cosine distance."""
    return 1.0 - float(distance)
