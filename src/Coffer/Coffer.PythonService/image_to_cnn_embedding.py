from PIL import Image
import numpy as np
import torch.nn.functional as F
import torch
from torchvision import models, transforms
from torch import nn

# ✅ Import or redefine the same model class used during training
class ResNetEmbeddingWithClassifier(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        base = models.resnet18(weights=None)  # no pretrained weights here for loading
        num_feats = base.fc.in_features
        base.fc = nn.Identity()

        self.backbone = base
        self.embedding_head = nn.Sequential(
            nn.Linear(num_feats, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, 256)
        )
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, x):
        feats = self.backbone(x)
        embedding = F.normalize(self.embedding_head(feats), p=2, dim=1)
        logits = self.classifier(embedding)
        return embedding, logits

def image_to_cnn_embedding(model: nn.Module, image_array: np.ndarray, device: str = "cpu") -> np.ndarray:
    """
    Converts an RGB NumPy image into an embedding vector using your trained CNN model.

    Args:
        model (nn.Module): Your trained embedding model (e.g. fine-tuned ResNet18).
        image_array (np.ndarray): RGB image as NumPy array (H, W, 3).
        device (str): "cpu" or "cuda".

    Returns:
        np.ndarray: Normalized embedding vector (float32).
    """

    # --- Validate input ---
    if image_array.ndim != 3 or image_array.shape[-1] != 3:
        raise ValueError("Input image must be an RGB NumPy array with shape (H, W, 3).")

    # --- Preprocessing (same as training) ---
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),  # Must match training input size
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
    ])

    # --- Convert image ---
    image_pil = Image.fromarray(image_array.astype(np.uint8))
    image_tensor = preprocess(image_pil).unsqueeze(0).to(device)

    # --- Encode with trained model ---
    model.eval()
    with torch.no_grad():
        embedding, _ = model(image_tensor)

    # --- Normalize the embedding ---
    embedding = embedding.cpu().numpy().flatten()
    embedding = embedding / np.linalg.norm(embedding)

    return embedding.astype(np.float32)