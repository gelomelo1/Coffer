import torch

TEST_UPLOAD_DIR = "E:\\Homework\\Programming\\AI\\szakdolgozat\\apitest"
DOTENV_PATH = "E:\Homework\Programming\AI\Coffer\src\.env"
VECTOR_COLLECTION_NAME = "itemvectors"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OBJECT_DETECTION_THRESHOLD = 0.9
# Thresholds of models without their own (cosine). They equal what the service applied before the vector store
# used cosine distance (1 - squared L2 = 2*cos - 1 at 0.95 / 0.85).
LEGACY_THRESHOLDS = {"found": 0.975, "similar": 0.925}