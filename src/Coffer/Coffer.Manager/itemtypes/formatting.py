"""Texts and table rows of the item type tabs (pure, so they can be unit tested)."""

DATA_TYPES = [
    (0, "Text"),
    (1, "Number"),
    (2, "Date"),
    (3, "Yes / no"),
    (4, "Select"),
    (5, "Multi-select"),
    (6, "Autocomplete"),
]
DATA_TYPE_NAMES = dict(DATA_TYPES)
OPTION_TYPES = {4, 5, 6}

BLOCKERS = {
    "itemTypeNeedsModels": "upload both AI models",
    "itemTypeNeedsPrimaryAttribute": "mark exactly one attribute as primary",
    "itemTypeNeedsIcon": "upload an icon",
}


def _models_state(t):
    detection, embedding = t.get("detection"), t.get("embedding")
    if detection and embedding:
        return "both"
    if detection:
        return "detection only"
    if embedding:
        return "embedding only"
    return "missing"


def type_row(t):
    """Item type list row: name, published state, models, collections / listings using it."""
    return (t["name"], "published" if t.get("published") else "hidden", _models_state(t),
            f"{t.get('collections', 0)} / {t.get('listings', 0)}")


def _size(num_bytes):
    return f"{num_bytes / 1024 / 1024:.1f} MB"


def models_text(t):
    def one(label, model):
        if not model:
            return f"{label}: missing"
        classes = f", {model['classCount']} classes" if model.get("classCount") else ""
        return f"{label}: {model['fileName']} ({_size(model['bytes'])}{classes})"

    return f"{one('Detection', t.get('detection'))} · {one('Embedding', t.get('embedding'))}"


def blockers_text(t):
    blockers = t.get("publishBlockers") or []
    if not blockers:
        return "Ready to publish."
    return "Can't publish yet: " + ", ".join(BLOCKERS.get(b, b) for b in blockers) + "."


def attribute_row(a):
    """Attribute table row: name, data type, primary, required, option set, how many items use it."""
    return (a["name"], DATA_TYPE_NAMES.get(a["dataType"], str(a["dataType"])), "primary" if a.get("primary") else "",
            "required" if a.get("required") else "", f"set #{a['optionSetId']}" if a.get("optionSetId") else "",
            f"{a.get('usedByItems', 0)} items")


def option_set_row(s):
    labels = ", ".join(o["label"] for o in s.get("options", []))
    return (s["id"], labels if len(labels) <= 60 else labels[:57] + "…", "; ".join(s.get("usedBy") or []) or "unused")
