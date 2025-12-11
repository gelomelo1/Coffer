import os
from ultralytics import YOLO
import cv2

def crop_images(source, dest, model_path, recursive=False):
    """
    Crop detected objects from images using YOLOv8.

    Args:
        source (str): Source folder path.
        dest (str): Destination folder path.
        model_path (str): YOLOv8 .pt model path.
        recursive (bool): If True, process subfolders and preserve folder structure.
    """

    model = YOLO(model_path)

    if recursive:
        for root_dir, _, files in os.walk(source):
            img_files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'))]
            if not img_files:
                continue

            rel_path = os.path.relpath(root_dir, source)
            dest_dir = os.path.join(dest, rel_path)
            os.makedirs(dest_dir, exist_ok=True)

            for img_file in img_files:
                img_path = os.path.join(root_dir, img_file)
                result = model.predict(source=img_path, save=False)[0]

                base_name, _ = os.path.splitext(img_file)
                for j, box in enumerate(result.boxes):
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = xyxy
                    cropped = result.orig_img[y1:y2, x1:x2]
                    conf = float(box.conf)
                    crop_path = os.path.join(dest_dir, f"{base_name}_{j+1}_{conf:.2f}.jpg")
                    cv2.imwrite(crop_path, cropped)
    else:
        os.makedirs(dest, exist_ok=True)
        img_files = [f for f in os.listdir(source) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'))]
        for img_file in img_files:
            img_path = os.path.join(source, img_file)
            result = model.predict(source=img_path, save=False)[0]

            base_name, _ = os.path.splitext(img_file)
            for j, box in enumerate(result.boxes):
                xyxy = box.xyxy[0].cpu().numpy().astype(int)
                x1, y1, x2, y2 = xyxy
                cropped = result.orig_img[y1:y2, x1:x2]
                conf = float(box.conf)
                crop_path = os.path.join(dest, f"{base_name}_{j+1}_{conf:.2f}.jpg")
                cv2.imwrite(crop_path, cropped)