"""Run folders: one per training run, holding everything needed to understand and repeat it.

<runs root>/<yyyyMMdd-HHmmss>_<kind>_<name>/  config.json, manifest.json, log.txt, progress.json, metrics.csv,
detection.pt | embedding.pt, report.json, report.md (and live_*.pt, the model it is compared with).
"""
import json
import os
import re
from datetime import datetime

from training import config as config_module

PHASES = ("checking", "training", "evaluating", "done", "failed", "stopped")
FINISHED = ("done", "failed", "stopped")


def slug(name: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return (text or "run")[:40].rstrip("-")


def create_run(runs_root: str, cfg) -> str:
    os.makedirs(runs_root, exist_ok=True)
    base = f"{datetime.now():%Y%m%d-%H%M%S}_{cfg.kind}_{slug(cfg.name)}"
    run_dir, n = os.path.join(runs_root, base), 2
    while os.path.exists(run_dir):
        run_dir, n = os.path.join(runs_root, f"{base}-{n}"), n + 1
    os.makedirs(run_dir)
    config_module.save(cfg, os.path.join(run_dir, "config.json"))
    write_progress(run_dir, "checking")
    return run_dir


def write_progress(run_dir: str, phase: str, **fields) -> None:
    if phase not in PHASES:
        raise ValueError(phase)
    data = {"phase": phase, "updated": datetime.now().isoformat(timespec="seconds"), **fields}
    temp = os.path.join(run_dir, "progress.json.tmp")
    with open(temp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(temp, os.path.join(run_dir, "progress.json"))


def read_progress(run_dir: str) -> dict:
    try:
        with open(os.path.join(run_dir, "progress.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"phase": "failed", "message": "progress.json is missing or unreadable"}


def log(run_dir: str, message: str) -> None:
    with open(os.path.join(run_dir, "log.txt"), "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%H:%M:%S} {message}\n")


def read_json(run_dir: str, name: str):
    try:
        with open(os.path.join(run_dir, name), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def list_runs(runs_root: str) -> list:
    """Every run, newest first: {id, path, kind, name, phase, created, headline}."""
    if not os.path.isdir(runs_root):
        return []
    result = []
    folders = [n for n in os.listdir(runs_root) if os.path.isdir(os.path.join(runs_root, n))]
    # Name first (its time stamp), then creation time for runs started within the same second.
    folders.sort(key=lambda n: (n[:15], os.stat(os.path.join(runs_root, n)).st_ctime_ns), reverse=True)
    for name in folders:
        path = os.path.join(runs_root, name)
        cfg = read_json(path, "config.json") if os.path.isdir(path) else None
        if not cfg:
            continue
        progress = read_progress(path)
        rep = read_json(path, "report.json") or {}
        result.append({"id": name, "path": path, "kind": cfg.get("kind"), "name": cfg.get("name"),
                       "phase": progress.get("phase"), "created": name[:15], "headline": rep.get("headline", "")})
    return result
