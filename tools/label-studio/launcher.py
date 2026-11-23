"""LabelStudio.exe — starts the bundled Label Studio with its data next to the executable.

    LabelStudio.exe                     opens http://localhost:8080 in the browser
    LabelStudio.exe --port 8090         any `label-studio start` option is passed through

Data (projects, photos, annotations, the account) is kept in the "data" folder beside LabelStudio.exe, so the
whole folder can be moved or copied to another Windows PC. Close this window (or press Ctrl+C) to stop it.
"""
import os
import subprocess
import sys


def base_dir() -> str:
    return os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))


def command(base: str, args: list) -> list:
    python = os.path.join(base, "python", "python.exe")
    code = "import sys; from label_studio.server import main; sys.argv[0] = 'label-studio'; sys.exit(main())"
    return [python, "-c", code, "start", *args]


def environment(base: str) -> dict:
    env = dict(os.environ)
    env.setdefault("LABEL_STUDIO_BASE_DATA_DIR", os.path.join(base, "data"))
    env["PYTHONUTF8"] = "1"
    env.pop("PYTHONHOME", None)
    env.pop("PYTHONPATH", None)
    return env


def main() -> int:
    base = base_dir()
    env = environment(base)
    os.makedirs(env["LABEL_STUDIO_BASE_DATA_DIR"], exist_ok=True)
    print(f"Label Studio — data in {env['LABEL_STUDIO_BASE_DATA_DIR']}")
    print("The first start prepares the database and takes a minute. Close this window to stop Label Studio.\n")
    try:
        return subprocess.call(command(base, sys.argv[1:]), env=env)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
