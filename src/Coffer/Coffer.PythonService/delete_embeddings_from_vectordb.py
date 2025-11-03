def delete_embeddings_from_vectordb(collection, collection_id: str):
    """
    Delete all items from a ChromaDB collection that belong to a specific collection_id.

    Args:
        collection: ChromaDB collection object.
        collection_id (str): The collection_id metadata value to match for deletion.
    """
    collection.delete(where={"collection_id": collection_id})