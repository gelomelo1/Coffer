"""A detection model on the test set: precision, recall, F1 and mAP, at the confidence with the best F1 (never
above 0.9, never below 0.05)."""
import os

from training.detection_train import _write_list
from training.metrics import pick_confidence

MIN_CONFIDENCE = 0.05


def evaluate_detection(run_dir: str, model_path: str, test: list, class_name: str, imgsz: int, device: str = "cpu") -> dict:
    from ultralytics import YOLO

    folder = os.path.join(run_dir, "data")
    os.makedirs(folder, exist_ok=True)
    test_txt = _write_list(os.path.join(folder, "test.txt"), [img for img, _ in test])
    yaml_path = os.path.join(folder, "test.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(f"train: {test_txt.replace(chr(92), '/')}\nval: {test_txt.replace(chr(92), '/')}\nnames:\n  0: {class_name}\n")

    name = "eval_" + os.path.splitext(os.path.basename(model_path))[0]
    result = YOLO(model_path).val(data=yaml_path, imgsz=imgsz, device=0 if device == "cuda" else "cpu", plots=False,
                                  verbose=False, project=run_dir, name=name, exist_ok=True, workers=0, batch=8)
    box = result.box
    px = list(box.px) if len(box.px) else [0.0]
    f1 = list(box.f1_curve[0]) if len(box.f1_curve) else [0.0] * len(px)
    confidence = max(MIN_CONFIDENCE, pick_confidence(px, f1))
    i = min(range(len(px)), key=lambda k: abs(px[k] - confidence))
    pick = (lambda curve: float(curve[0][i]) if len(curve) else 0.0)
    return {
        "precision": pick(box.p_curve),
        "recall": pick(box.r_curve),
        "f1": pick(box.f1_curve),
        "map50": float(box.map50),
        "map50_95": float(box.map),
        "confidence": confidence,
    }
