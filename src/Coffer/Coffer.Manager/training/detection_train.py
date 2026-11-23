"""Detection training with Ultralytics on a Label Studio YOLO export. Validation photos are held out by capture
session; the best checkpoint (validation mAP50-95) becomes the run's detection.pt."""
import os
import shutil

from training import runs
from training.datasets import split_by_session


class StopRequested(Exception):
    """The admin pressed Stop (the STOP file exists in the run folder)."""


def _write_list(path: str, images) -> str:
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(os.path.abspath(p).replace("\\", "/") for p in images) + "\n")
    return path


def write_yolo_dataset(run_dir: str, train: list, val: list, class_name: str) -> str:
    """data/train.txt, data/val.txt (absolute image paths; Ultralytics finds labels/ next to images/) and
    data/data.yaml. Returns the yaml path."""
    folder = os.path.join(run_dir, "data")
    os.makedirs(folder, exist_ok=True)
    train_txt = _write_list(os.path.join(folder, "train.txt"), [img for img, _ in train])
    val_txt = _write_list(os.path.join(folder, "val.txt"), [img for img, _ in val])
    yaml_path = os.path.join(folder, "data.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(f"train: {train_txt.replace(chr(92), '/')}\nval: {val_txt.replace(chr(92), '/')}\nnames:\n  0: {class_name}\n")
    return yaml_path


def ultralytics_args(cfg, data_yaml: str, run_dir: str, device: str) -> dict:
    return {
        "data": data_yaml,
        "epochs": cfg.epochs,
        "imgsz": cfg.imgsz,
        "batch": cfg.batch,
        "patience": cfg.patience,
        "freeze": cfg.freeze or None,
        "lr0": cfg.lr0,
        "degrees": cfg.degrees,
        "scale": cfg.scale,
        "translate": cfg.translate,
        "fliplr": cfg.fliplr,
        "mosaic": cfg.mosaic,
        "hsv_h": cfg.hsv_h,
        "hsv_s": cfg.hsv_s,
        "hsv_v": cfg.hsv_v,
        "seed": cfg.seed,
        "deterministic": True,
        "project": run_dir,
        "name": "yolo",
        "exist_ok": True,
        "plots": False,
        "device": 0 if device == "cuda" else "cpu",
        "workers": 0,
        "verbose": False,
    }


def train_detection(run_dir: str, cfg, data, device: str, stop_file: str) -> str:
    from ultralytics import YOLO

    train, val = split_by_session(data.train, cfg.val_fraction, cfg.seed, path_of=lambda pair: pair[0])
    runs.log(run_dir, f"Training photos: {len(train)}; validation photos (whole sessions): {len(val)}.")
    data_yaml = write_yolo_dataset(run_dir, train, val, data.class_name)

    model = YOLO(cfg.base_model)

    def on_batch_end(trainer):
        if os.path.exists(stop_file):
            raise StopRequested()

    def on_epoch_end(trainer):
        m = trainer.metrics or {}
        runs.write_progress(run_dir, "training", epoch=trainer.epoch + 1, epochs=cfg.epochs,
                            map50=round(float(m.get("metrics/mAP50(B)", 0)), 4),
                            map50_95=round(float(m.get("metrics/mAP50-95(B)", 0)), 4))
        runs.log(run_dir, f"Epoch {trainer.epoch + 1}/{cfg.epochs}: validation mAP50-95 {float(m.get('metrics/mAP50-95(B)', 0)):.3f}")

    model.add_callback("on_train_batch_end", on_batch_end)
    model.add_callback("on_fit_epoch_end", on_epoch_end)
    model.train(**ultralytics_args(cfg, data_yaml, run_dir, device))

    weights = os.path.join(run_dir, "yolo", "weights")
    best = os.path.join(weights, "best.pt")
    if not os.path.exists(best):
        best = os.path.join(weights, "last.pt")
    path = os.path.join(run_dir, "detection.pt")
    shutil.copy(best, path)
    results = os.path.join(run_dir, "yolo", "results.csv")
    if os.path.exists(results):
        shutil.copy(results, os.path.join(run_dir, "metrics.csv"))
    return path
