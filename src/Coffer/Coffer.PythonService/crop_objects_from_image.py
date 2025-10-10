from ultralytics import YOLO
import numpy as np
import cv2
from typing import List

def crop_objects_from_image(model: YOLO, image_array: np.ndarray, conf_threshold: float = 0.25) -> List[np.ndarray]:
    """
    Detects objects in an in-memory image and returns a list of cropped images (NumPy arrays, RGB).

    Args:
        model (YOLO): The loaded YOLO model instance.
        image_array (np.ndarray): The input image (NumPy array, BGR or RGB).
        conf_threshold (float): Detection confidence threshold.

    Returns:
        List[np.ndarray]: A list of cropped image arrays (RGB format).
    """

    # Ensure the input image is RGB (YOLO expects RGB)
    if image_array.shape[-1] == 3:
        image_rgb = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
    else:
        raise ValueError("Input image must have 3 color channels.")

    # Run YOLO detection
    results = model.predict(source=image_rgb, imgsz=512, conf=conf_threshold, verbose=False)
    res = results[0]
    crops = []

    # Extract crops based on bounding boxes
    for box in res.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        # Crop the region (ensure valid slice)
        cropped = image_rgb[y1:y2, x1:x2]
        if cropped.size == 0:
            continue

        crops.append(cropped)

    return crops