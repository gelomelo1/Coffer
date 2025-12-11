
def delete_embedding_from_vectordb(
    collection,
    id: str,
):
    """
    Delete an item from a ChromaDB collection by ID.

    Args:
        collection: ChromaDB collection object.
        id (str): The unique ID of the item to delete.
    """

    collection.delete(ids=[id]) 