"""Builds the standalone Coffer.Manager for Windows (64-bit):  dist/Coffer.Manager/Coffer.Manager.exe

Run with the Manager's own Python (VS Code task "Build Coffer.Manager executable"):
    venv\\Scripts\\python.exe packaging\\build_manager.py

The result is a folder (not a single .exe: the GPU libraries are ~3 GB and a single file would unpack them on every
start). Copy the whole folder to another Windows PC; no Python is needed there. Training uses an NVIDIA GPU when
the PC has one and its driver supports CUDA 12.6, otherwise the CPU. After building, the executable's --self-test
runs and the build fails if it does not pass.
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MANAGER = os.path.dirname(HERE)
DIST = os.path.join(MANAGER, "dist")
WORK = os.path.join(MANAGER, "build")
NAME = "Coffer.Manager"
APP_DIR = os.path.join(DIST, NAME)
EXE = os.path.join(APP_DIR, f"{NAME}.exe")

ENV_EXAMPLE = """# Coffer.Manager settings. Rename this file to ".env" (keep it next to Coffer.Manager.exe).
# The Coffer backend this Manager signs in to:
COFFER_API_URL=http://localhost:5141
# Where training runs are kept (default: <your user folder>\\CofferRuns):
# COFFER_RUNS_DIR=D:\\CofferRuns
"""

README = """Coffer.Manager
==============

1. Rename ".env.example" to ".env" and set COFFER_API_URL to your Coffer backend.
2. Start Coffer.Manager.exe and sign in with your administrator GitHub account.

Model training uses an NVIDIA GPU when there is one (driver with CUDA 12.6 support), otherwise the CPU (slow).
Each training run writes its folder under COFFER_RUNS_DIR; a run's worker.log has the training output.
Check this copy works on a new PC:  Coffer.Manager.exe --self-test  (then read self-test.log next to the .exe).
"""


def run_pyinstaller() -> None:
    args = [
        sys.executable, "-m", "PyInstaller", os.path.join(MANAGER, "app.py"),
        "--name", NAME,
        "--noconfirm", "--clean", "--windowed", "--onedir",
        "--distpath", DIST, "--workpath", WORK, "--specpath", WORK,
        "--paths", MANAGER,
        # Ultralytics reads its model / dataset configuration files at run time and imports modules dynamically.
        "--collect-all", "ultralytics",
        "--collect-submodules", "pytorch_metric_learning",
        "--collect-submodules", "markdown_it",
        "--collect-data", "torchvision",
        # The Manager's own packages (imported from app.py, initialize.py and lazily in the worker).
        "--collect-submodules", "training",
        "--collect-submodules", "reports",
        "--collect-submodules", "itemtypes",
        "--collect-submodules", "news",
        "--hidden-import", "initialize",
    ]
    subprocess.run(args, check=True, cwd=MANAGER)


def finish() -> None:
    with open(os.path.join(APP_DIR, ".env.example"), "w", encoding="utf-8") as f:
        f.write(ENV_EXAMPLE)
    with open(os.path.join(APP_DIR, "README.txt"), "w", encoding="utf-8") as f:
        f.write(README)


def self_test() -> None:
    log = os.path.join(APP_DIR, "self-test.log")
    if os.path.exists(log):
        os.remove(log)
    code = subprocess.run([EXE, "--self-test"], cwd=APP_DIR, timeout=600).returncode
    output = open(log, encoding="utf-8").read().strip() if os.path.exists(log) else "(no self-test.log)"
    print(output)
    if code != 0:
        raise SystemExit(f"The built executable failed its self-test (exit code {code}).")


def folder_size_gb(path: str) -> float:
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, files in os.walk(path) for f in files) / 1024 ** 3


if __name__ == "__main__":
    if os.path.isdir(APP_DIR):
        shutil.rmtree(APP_DIR)
    run_pyinstaller()
    finish()
    self_test()
    print(f"Built {EXE} ({folder_size_gb(APP_DIR):.1f} GB). Copy the whole {APP_DIR} folder.")
