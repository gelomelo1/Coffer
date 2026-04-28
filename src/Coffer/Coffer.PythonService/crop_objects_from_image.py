from ultralytics import YOLO
import numpy as np
import cv2
from typing import List

from config import TEST_UPLOAD_DIR

def crop_objects_from_image(model: YOLO, image_array: np.ndarray, conf_threshold: float = 0.8) -> List[np.ndarray]:
    """
    Detects objects in an in-memory image and returns a list of cropped images (NumPy arrays, RGB).

    Args:
        model (YOLO): The loaded YOLO model instance.
        image_array (np.ndarray): The input image (NumPy array, BGR or RGB).
        conf_threshold (float): Detection confidence threshold.

    Returns:
        List[np.ndarray]: A list of cropped image arrays (RGB format).
    """
    
    results = model.predict(source=image_array, imgsz=512, conf=conf_threshold, verbose=False)
    res = results[0]
    crops = []

    for box in res.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        cropped = image_array[y1:y2, x1:x2]
        if cropped.size == 0:
            continue

        crops.append(cropped)

    return crops