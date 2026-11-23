"""Cropping caps out of photos with a detection model (to build embedding training or test folders)."""
import os

import numpy as np
from PIL import Image

from training.coffer_models import load_detection_model
from training.datasets import IMAGE_EXTENSIONS


def crop_folder(model_path: str, source: str, dest: str) -> int:
    """Every photo under source (sub-folders kept) → one JPEG per detected cap under dest. Returns the crop count."""
    model = load_detection_model(model_path)
    count = 0
    for folder, _, files in os.walk(source):
        out = os.path.join(dest, os.path.relpath(folder, source))
        for name in sorted(files):
            stem, ext = os.path.splitext(name)
            if ext.lower() not in IMAGE_EXTENSIONS:
                continue
            with Image.open(os.path.join(folder, name)) as img:
                rgb = np.asarray(img.convert("RGB"))
            for i, crop in enumerate(model.crops(rgb), start=1):
                os.makedirs(out, exist_ok=True)
                Image.fromarray(crop).save(os.path.join(out, f"{stem}_{i}.jpg"), quality=95)
                count += 1
    return count
