"""Builds a portable Label Studio for Windows (64-bit):  tools/label-studio/dist/LabelStudio/LabelStudio.exe

Run with a Python 3.13 that has PyInstaller (the Coffer.Manager venv; VS Code task "Build Label Studio executable"):
    src\\Coffer\\Coffer.Manager\\venv\\Scripts\\python.exe tools\\label-studio\\build_label_studio.py

What it makes (copy the whole LabelStudio folder to any Windows PC; nothing has to be installed there):
    LabelStudio.exe   small launcher (start it to open Label Studio in the browser)
    python/           Python's official "embeddable" Windows runtime, same version as this build, with
                      label-studio installed into it
    data/             created on first start: projects, photos, annotations (kept with the folder)

Why not one PyInstaller executable: Label Studio is a Django web app with many dynamic imports, templates and
static files; running it on a real (portable) Python is far more reliable than freezing it.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

LABEL_STUDIO = "label-studio==1.21.0"
# Exact versions of a working Label Studio 1.21 install: a fresh resolve picks newer releases it is not
# compatible with (e.g. sentry-sdk 3 refuses the options Label Studio passes and it cannot start).
CONSTRAINTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "constraints.txt")
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
WORK = os.path.join(HERE, "build")
APP = os.path.join(DIST, "LabelStudio")
PY = os.path.join(APP, "python")
VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
EMBED_URL = f"https://www.python.org/ftp/python/{VERSION}/python-{VERSION}-embed-amd64.zip"


def embeddable_python() -> None:
    os.makedirs(WORK, exist_ok=True)
    archive = os.path.join(WORK, os.path.basename(EMBED_URL))
    if not os.path.exists(archive):
        print(f"Downloading {EMBED_URL}")
        urllib.request.urlretrieve(EMBED_URL, archive)
    with zipfile.ZipFile(archive) as z:
        z.extractall(PY)
    # The embeddable runtime ignores site-packages unless its ._pth file lists it and enables `import site`.
    pth = next(f for f in os.listdir(PY) if f.endswith("._pth"))
    tag = pth[:-len("._pth")]
    with open(os.path.join(PY, pth), "w", encoding="utf-8") as f:
        f.write(f"{tag}.zip\n.\nLib\\site-packages\nimport site\n")


def install_label_studio() -> None:
    target = os.path.join(PY, "Lib", "site-packages")
    os.makedirs(target, exist_ok=True)
    print(f"Installing {LABEL_STUDIO} into the portable Python (downloads the packages)")
    subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-warn-script-location",
                    "--ignore-installed", "--target", target, "-c", CONSTRAINTS, LABEL_STUDIO], check=True)


def launcher() -> None:
    subprocess.run([sys.executable, "-m", "PyInstaller", os.path.join(HERE, "launcher.py"), "--name", "LabelStudio",
                    "--onefile", "--console", "--noconfirm", "--distpath", APP,
                    "--workpath", os.path.join(WORK, "launcher"), "--specpath", os.path.join(WORK, "launcher")],
                   check=True)
    with open(os.path.join(APP, "README.txt"), "w", encoding="utf-8") as f:
        f.write("Label Studio (portable)\n=======================\n\n"
                "Start LabelStudio.exe: when Label Studio is ready, the browser opens its sign-in page\n"
                "(http://localhost:8080/user/login/, or the next free port if 8080 is taken: see the window).\n"
                "If the browser ever shows 'Not Found' for /index.html, it remembers a redirect from another app\n"
                "that used the same port: open the /user/login/ address above directly.\n"
                "The first start prepares the database (about a minute); sign up there with any e-mail and password.\n"
                "Everything you make is kept in the 'data' folder next to LabelStudio.exe: copy the whole folder to\n"
                "move it to another PC. Another port: LabelStudio.exe --port 8090. Close the window to stop it.\n\n"
                "For Coffer: create a project with the 'Object Detection with Bounding Boxes' template and one label\n"
                "'cap', then Export > YOLO. See Coffer.Manager > Model training > How to prepare the data.\n")


def smoke_test() -> None:
    """Starts the built Label Studio on a spare port with a throw-away data folder and waits for /health/."""
    port = "8099"
    data = tempfile.mkdtemp(prefix="ls-smoke-")
    env = dict(os.environ, LABEL_STUDIO_BASE_DATA_DIR=data)
    process = subprocess.Popen([os.path.join(APP, "LabelStudio.exe"), "--port", port, "--no-browser"], env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.time() + 600
        while time.time() < deadline:
            if process.poll() is not None:
                raise SystemExit(f"Label Studio exited during the smoke test (code {process.returncode}).")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health/", timeout=3) as r:
                    print("Smoke test: /health/ answered", r.status, r.read()[:60])
                    return
            except OSError:
                time.sleep(3)
        raise SystemExit("Label Studio did not answer /health/ within 10 minutes.")
    finally:
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
        shutil.rmtree(data, ignore_errors=True)


def folder_size_gb(path: str) -> float:
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, files in os.walk(path) for f in files) / 1024 ** 3


if __name__ == "__main__":
    if sys.version_info[:2] != (3, 13):
        raise SystemExit("Build with Python 3.13 (Label Studio 1.21's dependencies are installed for this version).")
    if os.path.isdir(APP):
        shutil.rmtree(APP)
    embeddable_python()
    install_label_studio()
    launcher()
    smoke_test()
    print(f"Built {os.path.join(APP, 'LabelStudio.exe')} ({folder_size_gb(APP):.1f} GB). Copy the whole {APP} folder.")
