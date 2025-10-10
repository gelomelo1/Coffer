import uuid
from typing import List, Tuple, Dict
import numpy as np
from ultralytics import YOLO
from torch import nn

from cosine_similarity import cosine_similarity
from crop_objects_from_image import crop_objects_from_image
from image_to_cnn_embedding import image_to_cnn_embedding

def object_detection_similarity_pipeline(
    yolo_model: YOLO,
    cnn_model: nn.Module,
    image_array: np.ndarray,
    conf_threshold: float = 0.25
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Full pipeline: YOLO object detection, CLIP embeddings, and pairwise cosine similarity.

    Args:
        yolo_model (YOLO): Loaded YOLO model.
        clip_model (SentenceTransformer): Loaded CLIP model.
        image_array (np.ndarray): Input RGB image as NumPy array.
        conf_threshold (float): YOLO detection confidence threshold.

    Returns:
        Tuple:
            - cropped_images: List of dicts {"id": str, "image": np.ndarray}
            - embeddings: List of dicts {"id": str, "embedding": np.ndarray}
            - similarities: List of dicts {"id1": str, "id2": str, "similarity": float}
    """

    # 1️⃣ Detect and crop objects
    crops = crop_objects_from_image(yolo_model, image_array, conf_threshold=conf_threshold)

    # Assign random UUIDs to each crop
    cropped_images = [{"id": str(uuid.uuid4()), "image": crop} for crop in crops]

    # 2️⃣ Generate embeddings
    embeddings = []
    for item in cropped_images:
        emb = image_to_cnn_embedding(cnn_model, item["image"])
        embeddings.append({"id": item["id"], "embedding": emb})

    # 3️⃣ Compute pairwise cosine similarities (unique pairs only)
    similarities = []
    n = len(embeddings)
    for i in range(n):
        for j in range(i + 1, n):
            id1 = embeddings[i]["id"]
            id2 = embeddings[j]["id"]
            sim = cosine_similarity(embeddings[i]["embedding"], embeddings[j]["embedding"])
            similarities.append({"id1": id1, "id2": id2, "similarity": sim})

    return cropped_images, embeddings, similarities