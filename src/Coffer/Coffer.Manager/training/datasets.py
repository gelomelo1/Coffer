"""Training and test data: reading the two folder formats and refusing data that would make the test meaningless.

Embedding data: one sub-folder per cap variant, the folder name is the class.
Detection data: a Label Studio "YOLO" export — images/, labels/ (same file stem, .txt) and classes.txt.
"""
import hashlib
import os
import random
import re
from dataclasses import dataclass, field
from datetime import datetime

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
STAMP = re.compile(r"(20\d{6})[_-]?(\d{6})")
SESSION_GAP_SECONDS = 600
MIN_TRAIN_CLASSES = 4
MIN_TRAIN_IMAGES = 5


class DatasetError(Exception):
    def __init__(self, messages):
        self.messages = list(messages)
        super().__init__("\n".join(self.messages))


@dataclass
class EmbeddingData:
    train: dict
    test: dict
    warnings: list = field(default_factory=list)
    manifest: dict = field(default_factory=dict)


@dataclass
class DetectionData:
    train: list
    test: list
    class_name: str
    warnings: list = field(default_factory=list)
    manifest: dict = field(default_factory=dict)


def sha1(path: str) -> str:
    digest = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _images(folder: str) -> list:
    return sorted(os.path.join(folder, f) for f in os.listdir(folder)
                  if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS and os.path.isfile(os.path.join(folder, f)))


def class_folders(root: str) -> dict:
    """{class name: [image paths]} for every sub-folder of root."""
    if not os.path.isdir(root):
        raise DatasetError([f"Folder not found: {root}"])
    return {name: _images(os.path.join(root, name)) for name in sorted(os.listdir(root))
            if os.path.isdir(os.path.join(root, name))}


def yolo_export(root: str):
    """([(image, label)], class name) of a Label Studio YOLO export; an empty label file is a background image."""
    errors = []
    if not os.path.isdir(os.path.join(root, "images")) or not os.path.isdir(os.path.join(root, "labels")):
        raise DatasetError([f"{root} is not a YOLO export: it needs images/ and labels/ folders and classes.txt."])
    classes_file = os.path.join(root, "classes.txt")
    names = []
    if os.path.exists(classes_file):
        with open(classes_file, encoding="utf-8") as f:
            names = [line.strip() for line in f if line.strip()]
    if len(names) != 1:
        errors.append(f"{root}: classes.txt must list exactly one class (the cap); found {len(names)}.")
    pairs = []
    for img in _images(os.path.join(root, "images")):
        label = os.path.join(root, "labels", os.path.splitext(os.path.basename(img))[0] + ".txt")
        if not os.path.exists(label):
            errors.append(f"{img}: no label file (labels/{os.path.basename(label)}); every image needs one, empty for no caps.")
            continue
        with open(label, encoding="utf-8") as f:
            for n, line in enumerate(f, start=1):
                parts = line.split()
                if parts and (len(parts) != 5 or parts[0] != "0"):
                    errors.append(f"{label}:{n}: expected 'class x y w h' with class 0.")
                    break
        pairs.append((img, label))
    if errors:
        raise DatasetError(errors)
    return pairs, names[0]


def _overlap(train_paths, test_paths) -> list:
    by_hash = {}
    for path in train_paths:
        by_hash.setdefault(sha1(path), path)
    return [f"{path} is the same photo as training image {by_hash[h]}" for path in test_paths
            if (h := sha1(path)) in by_hash]


def _manifest(groups: dict) -> dict:
    """{split: [{path, class, sha1}]} — groups: {split: [(path, class)]}."""
    return {split: [{"path": p, "class": c, "sha1": sha1(p)} for p, c in items] for split, items in groups.items()}


def check_embedding(train_dir: str, test_dir: str) -> EmbeddingData:
    errors, warnings = [], []
    train = class_folders(train_dir)
    test = class_folders(test_dir)
    if len(train) < MIN_TRAIN_CLASSES:
        errors.append(f"The training data needs at least {MIN_TRAIN_CLASSES} cap folders; found {len(train)}.")
    if len(test) < 2:
        errors.append(f"The test set needs at least 2 cap folders; found {len(test)}.")
    for where, groups in (("training", train), ("test", test)):
        for name, images in groups.items():
            if len(images) < 2:
                errors.append(f"{where} class {name} has {len(images)} image(s); at least 2 are needed.")
            elif len(images) < 4 and where == "training":
                warnings.append(f"Training class {name} has only {len(images)} images; 4 or more from different sessions work better.")
    shared = sorted(set(n.lower() for n in train) & set(n.lower() for n in test))
    if shared:
        names = [n for n in test if n.lower() in shared]
        errors.append("These test caps are also training classes (the test must use unseen caps): " + ", ".join(names))
    errors += _overlap([p for v in train.values() for p in v], [p for v in test.values() for p in v])
    if errors:
        raise DatasetError(errors)
    manifest = _manifest({"train": [(p, c) for c, v in train.items() for p in v],
                          "test": [(p, c) for c, v in test.items() for p in v]})
    return EmbeddingData(train, test, warnings, manifest)


def check_detection(train_dir: str, test_dir: str) -> DetectionData:
    errors, warnings = [], []
    try:
        train, train_class = yolo_export(train_dir)
    except DatasetError as e:
        errors += e.messages
        train, train_class = [], None
    try:
        test, test_class = yolo_export(test_dir)
    except DatasetError as e:
        errors += e.messages
        test, test_class = [], None
    if train_class is not None and len(train) < MIN_TRAIN_IMAGES:
        errors.append(f"The training data needs at least {MIN_TRAIN_IMAGES} images; found {len(train)}.")
    if test_class is not None and len(test) < 2:
        errors.append(f"The test set needs at least 2 images; found {len(test)}.")
    if not errors:
        errors += _overlap([p for p, _ in train], [p for p, _ in test])
    if errors:
        raise DatasetError(errors)
    if train_class != test_class:
        warnings.append(f"The test set calls its class {test_class!r}, the training data {train_class!r}.")
    backgrounds = sum(1 for _, label in train if os.path.getsize(label) == 0)
    if backgrounds == 0:
        warnings.append("No background images (photos without caps) in the training data; 5–10% help against false detections.")
    manifest = _manifest({"train": [(p, train_class) for p, _ in train], "test": [(p, test_class) for p, _ in test]})
    return DetectionData(train, test, train_class, warnings, manifest)


def split_classes(classes, fraction: float, seed: int):
    """(training classes, validation classes): a seeded, class-disjoint split (at least one validation class)."""
    ordered = sorted(classes)
    random.Random(seed).shuffle(ordered)
    count = max(1, round(len(ordered) * fraction))
    return sorted(ordered[count:]), sorted(ordered[:count])


def _stamp(path: str):
    match = STAMP.search(os.path.basename(path))
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def split_by_session(items, fraction: float, seed: int, path_of=lambda item: item):
    """(train, val): photos taken within 10 minutes of each other (by the time in their file name) stay on the
    same side, so near-identical shots never sit in both. Files without a time are sessions of their own."""
    stamped = sorted((s, i) for i, item in enumerate(items) if (s := _stamp(path_of(item))) is not None)
    sessions, current, last = [], [], None
    for stamp, index in stamped:
        if last is not None and (stamp - last).total_seconds() > SESSION_GAP_SECONDS:
            sessions.append(current)
            current = []
        current.append(index)
        last = stamp
    if current:
        sessions.append(current)
    stamped_indexes = {i for _, i in stamped}
    sessions += [[i] for i in range(len(items)) if i not in stamped_indexes]

    random.Random(seed).shuffle(sessions)
    target = max(1, round(len(items) * fraction))
    val_indexes = set()
    for session in sessions:
        if len(val_indexes) >= target or len(val_indexes) + len(session) > max(target, len(items) - 1):
            continue
        val_indexes.update(session)
    if not val_indexes and sessions:
        val_indexes.update(min(sessions, key=len))
    train = [item for i, item in enumerate(items) if i not in val_indexes]
    val = [item for i, item in enumerate(items) if i in val_indexes]
    return train, val
