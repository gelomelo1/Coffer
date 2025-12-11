import chromadb

def list_collection(dest: str, name: str):
    client = chromadb.PersistentClient(path=dest)
    collection = client.get_collection(name)

    all_items = collection.get(include=['metadatas', 'documents'])

    print(f"Collection '{name}' has {len(all_items['ids'])} items:")
    for _id, metadata in zip(all_items['ids'], all_items['metadatas']):
        print(f"ID: {_id}, Metadata: {metadata}")