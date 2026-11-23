import uuid
from typing import Dict, List

import numpy as np

from coffer_models import DetectionModel, EmbeddingModel


def object_detection_similarity_pipeline(detection: DetectionModel, embedding: EmbeddingModel, image_array: np.ndarray) -> List[Dict]:
    """Detects the objects of an RGB image and embeds each crop: [{"id", "image", "embedding"}]."""
    results = []
    for crop in detection.crops(image_array):
        results.append({"id": str(uuid.uuid4()), "image": crop, "embedding": embedding.embed(crop)})
    return results
