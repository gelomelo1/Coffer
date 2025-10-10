import torch

# --- Config ---
UPLOAD_DIR = "E:\\Homework\\Programming\\AI\\szakdolgozat\\apitest"
YOLO_MODEL = "models\\1.pt"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CNN_MODEL = "E:\\Homework\\Programming\\AI\\szakdolgozat\\training\\ObjectSimilarity\\Model\\cap_similarity_model.pt"