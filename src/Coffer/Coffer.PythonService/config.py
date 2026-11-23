import torch

TEST_UPLOAD_DIR = "E:\\Homework\\Programming\\AI\\szakdolgozat\\apitest"
DOTENV_PATH = "E:\Homework\Programming\AI\Coffer\src\.env"
VECTOR_COLLECTION_NAME = "itemvectors"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# Thresholds of models without their own (cosine). They equal what the service applied before the vector store
# used cosine distance (1 - squared L2 = 2*cos - 1 at 0.95 / 0.85).
LEGACY_THRESHOLDS = {"found": 0.975, "similar": 0.925}
# Every item type shares one vector collection, so every embedding model must produce this many numbers.
VECTOR_DIMENSION = 256
