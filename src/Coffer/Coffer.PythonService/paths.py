"""Every data folder lives under one root, COFFER_ROOT_PATH (in Docker: /app). The backend derives the same folders the
same way (Coffer.BusinessLogic/AppConfig/AppPaths.cs), so the two always agree."""
import os

ROOT_VARIABLE = "COFFER_ROOT_PATH"


def root() -> str:
    value = os.getenv(ROOT_VARIABLE, "")
    if not value.strip():
        raise RuntimeError(f"{ROOT_VARIABLE} environmental variable is not set")
    return value


def images() -> str:
    return os.path.join(root(), "data", "images")


def icons() -> str:
    return os.path.join(root(), "data", "icons")


def vectors() -> str:
    return os.path.join(root(), "data", "vectors")


def temp() -> str:
    return os.path.join(root(), "data", "temp")


def models() -> str:
    return os.path.join(root(), "models")
