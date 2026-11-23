import uuid
from typing import Dict, List, Tuple

import numpy as np

from coffer_models import DetectionModel, EmbeddingModel
from cosine_similarity import cosine_similarity


def object_detection_similarity_pipeline_test(
    detection: DetectionModel,
    embedding: EmbeddingModel,
    image_array: np.ndarray,
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """Development check: crops, their embeddings, and the cosine similarity of every pair of crops."""
    cropped_images = [{"id": str(uuid.uuid4()), "image": crop} for crop in detection.crops(image_array)]
    embeddings = [{"id": item["id"], "embedding": embedding.embed(item["image"])} for item in cropped_images]

    similarities = []
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            sim = cosine_similarity(embeddings[i]["embedding"], embeddings[j]["embedding"])
            similarities.append({"id1": embeddings[i]["id"], "id2": embeddings[j]["id"], "similarity": sim})

    return cropped_images, embeddings, similarities
