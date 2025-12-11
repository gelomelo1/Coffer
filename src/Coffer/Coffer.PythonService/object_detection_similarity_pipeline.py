import uuid
from typing import List, Dict, Tuple
import numpy as np
from ultralytics import YOLO
from torch import nn

from crop_objects_from_image import crop_objects_from_image
from image_to_cnn_embedding import image_to_cnn_embedding


def object_detection_similarity_pipeline(
    yolo_model: YOLO,
    cnn_model: nn.Module,
    image_array: np.ndarray,
    conf_threshold: float = 0.8
) -> List[Dict]:
    """
    Full pipeline: YOLO object detection and CNN embeddings.

    Args:
        yolo_model (YOLO): Loaded YOLO model.
        cnn_model (nn.Module): Loaded CNN model.
        image_array (np.ndarray): Input image (BGR or RGB depending on crop_objects_from_image).
        conf_threshold (float): YOLO detection confidence threshold.

    Returns:
        List[Dict]: List of dicts, each containing:
            {
                "id": str,
                "image": np.ndarray,
                "embedding": np.ndarray
            }
    """

    crops = crop_objects_from_image(yolo_model, image_array, conf_threshold=conf_threshold)

    results = []
    for crop in crops:
        crop_id = str(uuid.uuid4())
        emb = image_to_cnn_embedding(cnn_model, crop)
        results.append({
            "id": crop_id,
            "image": crop,
            "embedding": emb
        })

    return results