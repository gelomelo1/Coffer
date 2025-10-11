import chromadb

def create_vector_database(dest: str, name: str):
    client = chromadb.PersistentClient(dest)
    collection = client.get_or_create_collection(name)

    print(f"✅ Collection '{name}' created or loaded at '{dest}'")