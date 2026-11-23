"""Loaded models, reused until their file changes: a model uploaded from Coffer.Manager is used by the next request,
and requests no longer load models from disk each time."""
import os
import threading

from coffer_models import load_detection_model, load_embedding_model
from config import DEVICE


class ModelCache:
    def __init__(self, loaders=None):
        self._loaders = loaders or {
            "embedding": lambda path: load_embedding_model(path, DEVICE),
            "detection": load_detection_model,
        }
        self._items = {}
        self._lock = threading.Lock()

    def _get(self, kind: str, path: str):
        stat = os.stat(path)
        key = (kind, os.path.abspath(path))
        stamp = (stat.st_mtime_ns, stat.st_size)
        with self._lock:
            hit = self._items.get(key)
            if hit and hit[0] == stamp:
                return hit[1]
            model = self._loaders[kind](path)
            self._items[key] = (stamp, model)
            return model

    def embedding(self, path: str):
        return self._get("embedding", path)

    def detection(self, path: str):
        return self._get("detection", path)
