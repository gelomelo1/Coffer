from fastapi import UploadFile
import numpy as np
import cv2
import os
from typing import List, Dict, Optional

async def uploadfile_to_numpy(upload_file: UploadFile) -> np.ndarray:
    file_bytes = await upload_file.read()
    
    np_arr = np.frombuffer(file_bytes, np.uint8)
    
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Cannot decode uploaded image")
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image_rgb

def save_images(crops: List[Dict], output_dir: str) -> None:
    """
    Saves in-memory images (NumPy arrays) to disk.

    Args:
        crops (List[Dict]): List of dicts {"id": str, "image": np.ndarray}
        output_dir (str): Directory to save images
    """
    os.makedirs(output_dir, exist_ok=True)

    for item in crops:
        img_id = item["id"]
        image = item["image"]

        image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        file_path = os.path.join(output_dir, f"{img_id}.jpg")
        cv2.imwrite(file_path, image_bgr)

def save_dicts_to_txt(data: List[Dict], file_path: str) -> None:
    """
    Saves a list of dicts to a tab-delimited TXT file.

    Args:
        data (List[Dict]): List of dictionaries with same keys
        file_path (str): Path to save the TXT file
    """
    if not data:
        raise ValueError("No data to save")

    headers = list(data[0].keys())
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\t".join(headers) + "\n")

        for item in data:
            row = [str(item[h]) for h in headers]
            f.write("\t".join(row) + "\n")



def find_file_containing(directory: str, substring: str) -> Optional[str]:
    """
    Search for the first file in `directory` whose name contains `substring`.
    
    Returns the filename with extension if found, or None if no match exists.
    """
    for filename in os.listdir(directory):
        if substring in filename:
            return filename
    return None