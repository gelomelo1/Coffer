"""LabelStudio.exe — starts the bundled Label Studio with its data next to the executable.

    LabelStudio.exe                     opens the sign-in page (http://localhost:8080/user/login/) in the browser
    LabelStudio.exe --port 8090         any `label-studio start` option is passed through
    LabelStudio.exe --no-browser        start without opening the browser

Data (projects, photos, annotations, the account) is kept in the "data" folder beside LabelStudio.exe, so the
whole folder can be moved or copied to another Windows PC. Close this window (or press Ctrl+C) to stop it.

The launcher opens the browser itself, at the sign-in page and only once Label Studio answers: a browser that
remembers a redirect from another app on the same port (e.g. "/" → "/index.html") would otherwise never reach it.
"""
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

DEFAULT_PORT = 8080


def base_dir() -> str:
    return os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))


def _port_free(port: int) -> bool:
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def choose_port(args: list, start: int = DEFAULT_PORT):
    """(port, args): the port given with --port / -p, or the first free one from `start` (added to the args)."""
    for i, arg in enumerate(args):
        if arg in ("--port", "-p") and i + 1 < len(args):
            return int(args[i + 1]), list(args)
        if arg.startswith("--port="):
            return int(arg.split("=", 1)[1]), list(args)
    port = start
    while not _port_free(port):
        port += 1
    return port, ["--port", str(port), *args]


def wants_browser(args: list) -> bool:
    return "--no-browser" not in args


def login_url(port: int) -> str:
    return f"http://localhost:{port}/user/login/"


def command(base: str, args: list) -> list:
    python = os.path.join(base, "python", "python.exe")
    code = "import sys; from label_studio.server import main; sys.argv[0] = 'label-studio'; sys.exit(main())"
    passed = [a for a in args if a != "--no-browser"]
    return [python, "-c", code, "start", *passed, "--no-browser"]


def environment(base: str) -> dict:
    env = dict(os.environ)
    env.setdefault("LABEL_STUDIO_BASE_DATA_DIR", os.path.join(base, "data"))
    env["PYTHONUTF8"] = "1"
    env.pop("PYTHONHOME", None)
    env.pop("PYTHONPATH", None)
    return env


def open_when_ready(port: int, process) -> None:
    """Opens the sign-in page as soon as Label Studio answers (the first start needs a minute for its database)."""
    deadline = time.time() + 600
    while time.time() < deadline and process.poll() is None:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health/", timeout=3):
                webbrowser.open(login_url(port))
                return
        except OSError:
            time.sleep(2)


def main() -> int:
    base = base_dir()
    env = environment(base)
    os.makedirs(env["LABEL_STUDIO_BASE_DATA_DIR"], exist_ok=True)
    port, args = choose_port(sys.argv[1:])
    print(f"Label Studio — data in {env['LABEL_STUDIO_BASE_DATA_DIR']}", flush=True)
    print(f"Open {login_url(port)} (the browser opens it when Label Studio is ready).", flush=True)
    print("The first start prepares the database and takes a minute. Close this window to stop Label Studio.\n", flush=True)
    process = subprocess.Popen(command(base, args), env=env)
    if wants_browser(args):
        threading.Thread(target=open_when_ready, args=(port, process), daemon=True).start()
    try:
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        return 0


if __name__ == "__main__":
    sys.exit(main())
