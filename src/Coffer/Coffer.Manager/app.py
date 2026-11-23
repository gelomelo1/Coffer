"""Coffer.Manager entry point.

    Coffer.Manager(.exe)                          the Manager window
    Coffer.Manager(.exe) --train-worker <run>     one training run (started by the Model training view)
    Coffer.Manager(.exe) --self-test              checks the bundle can import and run the training stack

The packaged executable has no Python of its own, so the training worker runs through the same executable.
"""
import multiprocessing
import os
import sys


def _redirect_output(path: str) -> None:
    """A windowed executable has no console (sys.stdout is None) — PyTorch / Ultralytics output goes to a file."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    stream = open(path, "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = stream


def _packaged() -> bool:
    return bool(getattr(sys, "frozen", False)) or sys.stdout is None


def self_test() -> int:
    """Imports every part the Manager and training need, runs one tiny forward pass of each model kind."""
    import markdown_it  # noqa: F401  (News preview)
    import numpy  # noqa: F401
    import PIL  # noqa: F401
    import pytorch_metric_learning  # noqa: F401
    import requests  # noqa: F401
    import torch
    import torchvision  # noqa: F401
    from ultralytics import YOLO

    import initialize  # noqa: F401  (every view)
    from training import crop, detection_eval, detection_train, embedding_eval, embedding_train, worker  # noqa: F401
    from training.coffer_models import EmbeddingNet

    with torch.no_grad():
        out = EmbeddingNet("resnet18", 256).eval()(torch.zeros(1, 3, 64, 64))
    assert out.shape == (1, 256)
    YOLO("yolov8n.yaml")  # built from Ultralytics' bundled configuration: nothing is downloaded
    device = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only"
    print(f"self-test ok: torch {torch.__version__}, {device}")
    return 0


def main(argv=None) -> int:
    argv = sys.argv if argv is None else argv
    if len(argv) >= 3 and argv[1] == "--train-worker":
        if _packaged():
            _redirect_output(os.path.join(argv[2], "worker.log"))
        from training.worker import run
        run(argv[2])
        return 0
    if len(argv) >= 2 and argv[1] == "--self-test":
        if _packaged():
            _redirect_output(os.path.join(os.path.dirname(sys.executable), "self-test.log"))
        try:
            return self_test()
        except Exception as e:
            print(f"self-test failed: {type(e).__name__}: {e}")
            return 1
    from initialize import App
    App().mainloop()
    return 0


if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
