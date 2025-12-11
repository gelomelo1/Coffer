import torch

TEST_UPLOAD_DIR = "E:\\Homework\\Programming\\AI\\szakdolgozat\\apitest"
DOTENV_PATH = "/var/www/coffer/.env.production"
VECTOR_COLLECTION_NAME = "itemvectors"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OBJECT_DETECTION_THRESHOLD = 0.9
SIMILARITY_THRESHOLD = 0.95