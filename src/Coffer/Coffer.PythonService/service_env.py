"""Settings of the AI service when it runs outside Docker (in Docker, docker-compose passes src/.env via env_file).

Only the keys this service reads are taken from the file: src/.env also holds the backend's settings and its large
development seed, which is longer than Windows allows an environment variable to be. Values already in the
environment win.
"""
import os
from typing import Optional

from dotenv import dotenv_values, find_dotenv

SERVICE_KEYS = ("COFFER_ROOT_PATH", "INTERNAL_API_KEY")


def load(path: Optional[str] = None) -> None:
    path = path or find_dotenv(usecwd=False)
    if not path or not os.path.isfile(path):
        return
    values = dotenv_values(path)
    for key in SERVICE_KEYS:
        value = values.get(key)
        if value is not None and key not in os.environ:
            os.environ[key] = value
