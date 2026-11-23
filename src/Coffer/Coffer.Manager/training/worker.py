"""One training run, started by Coffer.Manager as its own process:  python -m training.worker <run folder>

Phases (progress.json): checking → training → evaluating → done; failed with a message, or stopped when the STOP
file appears. The run folder holds everything: config, manifest, log, metrics, model, report.
"""
import json
import os
import sys
import traceback

import torch

from training import config, runs
from training.datasets import DatasetError, check_detection, check_embedding
from training.report import write_report


class _Stop(Exception):
    pass


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _run_embedding(run_dir, cfg, device, stop_file):
    from training.embedding_eval import evaluate_embedding
    from training.embedding_train import StopRequested, train_embedding
    from training.coffer_models import load_embedding_model, save_embedding_model

    data = check_embedding(cfg.train_dir, cfg.test_dir)
    _write_manifest(run_dir, data)
    runs.write_progress(run_dir, "training", epoch=0, epochs=cfg.epochs)
    try:
        model_path = train_embedding(run_dir, cfg, data, device, stop_file)
    except StopRequested:
        raise _Stop()

    runs.write_progress(run_dir, "evaluating")
    new = evaluate_embedding(model_path, data.test, device)
    live = _evaluate_live(run_dir, "embedding", lambda p: evaluate_embedding(p, data.test, device))
    thresholds = {"found": new["thresholds"]["found"], "similar": new["thresholds"]["similar"]}
    model = load_embedding_model(model_path)
    save_embedding_model(model_path, model.net, backbone=cfg.backbone, embedding_dim=cfg.embedding_dim,
                         image_size=cfg.image_size, thresholds=thresholds, classes=model.meta["classes"],
                         run_id=os.path.basename(run_dir))
    size = {"classes": len(data.test), "images": sum(len(v) for v in data.test.values())}
    return write_report(run_dir, "embedding", new, live, size, thresholds)


def _run_detection(run_dir, cfg, device, stop_file):
    from training.detection_eval import evaluate_detection
    from training.detection_train import StopRequested, train_detection
    from training.coffer_models import add_detection_metadata

    data = check_detection(cfg.train_dir, cfg.test_dir)
    _write_manifest(run_dir, data)
    runs.write_progress(run_dir, "training", epoch=0, epochs=cfg.epochs)
    try:
        model_path = train_detection(run_dir, cfg, data, device, stop_file)
    except StopRequested:
        raise _Stop()

    runs.write_progress(run_dir, "evaluating")
    new = evaluate_detection(run_dir, model_path, data.test, data.class_name, cfg.imgsz, device)
    live = _evaluate_live(run_dir, "detection",
                          lambda p: evaluate_detection(run_dir, p, data.test, data.class_name, cfg.imgsz, device))
    add_detection_metadata(model_path, imgsz=cfg.imgsz, confidence=new["confidence"], run_id=os.path.basename(run_dir))
    return write_report(run_dir, "detection", new, live, {"images": len(data.test)}, {"confidence": new["confidence"]})


def _evaluate_live(run_dir, kind, evaluate):
    live_path = os.path.join(run_dir, f"live_{kind}.pt")
    if not os.path.exists(live_path):
        runs.log(run_dir, "No live model to compare with.")
        return None
    try:
        return evaluate(live_path)
    except Exception as e:  # the comparison is useful but must not lose the new model
        runs.log(run_dir, f"The live model could not be evaluated: {type(e).__name__}: {e}")
        return None


def _write_manifest(run_dir, data):
    with open(os.path.join(run_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(data.manifest, f, indent=1)
    for warning in data.warnings:
        runs.log(run_dir, f"Warning: {warning}")


def run(run_dir: str) -> None:
    cfg = config.load(os.path.join(run_dir, "config.json"))
    stop_file = os.path.join(run_dir, "STOP")
    device = _device()
    model_path = os.path.join(run_dir, f"{cfg.kind}.pt")
    try:
        runs.write_progress(run_dir, "checking", device=device)
        runs.log(run_dir, f"Device: {device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))
        if os.path.exists(stop_file):
            raise _Stop()
        rep = (_run_embedding if cfg.kind == "embedding" else _run_detection)(run_dir, cfg, device, stop_file)
        runs.write_progress(run_dir, "done", headline=rep["headline"])
        runs.log(run_dir, f"Done: {rep['headline']}")
    except _Stop:
        if os.path.exists(model_path):
            os.remove(model_path)
        runs.write_progress(run_dir, "stopped")
        runs.log(run_dir, "Stopped.")
    except DatasetError as e:
        runs.write_progress(run_dir, "failed", message="\n".join(e.messages))
        runs.log(run_dir, "Data check failed:\n" + "\n".join(e.messages))
    except Exception as e:
        runs.write_progress(run_dir, "failed", message=f"{type(e).__name__}: {e}")
        runs.log(run_dir, traceback.format_exc())


def main(argv=None) -> None:
    argv = sys.argv if argv is None else argv
    run(argv[1])


if __name__ == "__main__":
    main()
