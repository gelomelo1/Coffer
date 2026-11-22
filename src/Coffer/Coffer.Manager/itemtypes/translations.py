"""Translation boxes of the item type tabs: the admin edits the stored JSON (language code -> text) as text.

An empty box shows a grey example of correct JSON for that field. The example is only a hint: it is never saved, and an
untouched box saves as {}. parse() mirrors the backend's checks so mistakes show next to the box before sending.
"""
import json
import re

_LANGUAGE = re.compile(r"^[a-z]{2}$")
_OPTIONS_EXAMPLE = re.compile(r'^\{"hu": "Opció \d+(;Opció \d+)*"\}$')

_EXAMPLES = {
    "name": {"hu": "Kupak"},
    "description": {"hu": "Rövid leírás a tárgytípusról"},
}


def placeholder(field, labels=None):
    """Example JSON for an empty box. field: "name" | "description" | "options" (one part per option label)."""
    if field == "options":
        count = max(1, len(labels or []))
        return json.dumps({"hu": ";".join(f"Opció {i + 1}" for i in range(count))}, ensure_ascii=False)
    return json.dumps(_EXAMPLES[field], ensure_ascii=False)


def is_placeholder(text):
    text = (text or "").strip()
    return text in (placeholder("name"), placeholder("description")) or bool(_OPTIONS_EXAMPLE.match(text))


def to_text(translations):
    """What the box shows for a stored value: '' for {} (the box then shows the grey example), else pretty JSON."""
    if not translations:
        return ""
    return json.dumps(translations, ensure_ascii=False, indent=2)


def parse(text, part_count=None):
    """Box text -> translations dict. '' or the example -> {}. Raises ValueError with a readable reason."""
    text = (text or "").strip()
    if not text or is_placeholder(text):
        return {}
    try:
        value = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Not valid JSON: {e.msg} (line {e.lineno}, column {e.colno}).") from None
    if not isinstance(value, dict):
        raise ValueError('Write an object like {"hu": "..."}.')

    result = {}
    for key, raw in value.items():
        if not isinstance(key, str) or not _LANGUAGE.match(key):
            raise ValueError(f'"{key}" is not a two-letter lowercase language code (like "hu").')
        if key == "en":
            raise ValueError("English is the main text, not a translation.")
        if not isinstance(raw, str) or not raw.strip():
            raise ValueError(f'"{key}" needs a text.')
        if part_count is not None:
            parts = [p.strip() for p in raw.split(";")]
            if len(parts) != part_count:
                raise ValueError(f'"{key}" has {len(parts)} labels; the list has {part_count} (separate them with ";").')
            if any(not p for p in parts):
                raise ValueError(f'Every "{key}" label needs a text.')
            result[key] = ";".join(parts)
        else:
            result[key] = raw.strip()
    return result
