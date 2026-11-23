"""Markdown editing helpers for the News editor's toolbar. Pure functions on (text, selection) so they are testable;
offsets are character indexes into the text, selection is [start, end)."""
import re

_HEADING = re.compile(r"^#{1,6} ")
_NUMBERED = re.compile(r"^\d+\. ")


def wrap(text, start, end, before, after):
    """Puts before/after around the selection, or takes them off when it is already wrapped.
    Returns (text, selection start, selection end) with the same words selected."""
    start, end = sorted((start, end))
    inner = text[start:end]
    # The markers are just outside the selection.
    if start >= len(before) and text[start - len(before):start] == before and text[end:end + len(after)] == after and inner:
        return text[:start - len(before)] + inner + text[end + len(after):], start - len(before), end - len(before)
    # The markers are selected with the words.
    if len(inner) >= len(before) + len(after) and inner.startswith(before) and inner.endswith(after) and inner != before:
        bare = inner[len(before):len(inner) - len(after)]
        return text[:start] + bare + text[end:], start, start + len(bare)
    return text[:start] + before + inner + after + text[end:], start + len(before), end + len(before)


def _line_span(text, start, end):
    first = text.rfind("\n", 0, start) + 1
    last = text.find("\n", max(end - 1, start) if end > start else end)
    return first, len(text) if last == -1 else last


def _has(line, prefix):
    return bool(_NUMBERED.match(line)) if prefix == "1. " else line.startswith(prefix)


def _strip(line, prefix):
    if prefix == "1. ":
        return _NUMBERED.sub("", line, count=1)
    if prefix.startswith("#"):
        return _HEADING.sub("", line, count=1)
    return line[len(prefix):] if line.startswith(prefix) else line


def prefix_lines(text, start, end, prefix):
    """Starts every line the selection touches with prefix ("# ", "- ", "> ", "1. " numbers 1, 2, 3 …); a heading
    replaces another heading level. When every line already has it, it is taken off. Returns (text, start, end)
    selecting the changed lines."""
    start, end = sorted((start, end))
    first, last = _line_span(text, start, end)
    lines = text[first:last].split("\n")
    if all(_has(line, prefix) for line in lines):
        changed = [_strip(line, prefix) for line in lines]
    else:
        changed = []
        for n, line in enumerate(lines, start=1):
            bare = _strip(line, prefix) if prefix.startswith("#") or prefix == "1. " else line
            changed.append((f"{n}. " if prefix == "1. " else prefix) + bare)
    block = "\n".join(changed)
    return text[:first] + block + text[last:], first, first + len(block)


def code_block(text, start, end):
    """Fences the selection as a code block on its own lines; returns (text, start, end) selecting the code."""
    start, end = sorted((start, end))
    head = text[:start]
    tail = text[end:]
    opening = ("" if not head or head.endswith("\n") else "\n") + "```\n"
    closing = "\n```" + ("" if tail.startswith("\n") else "\n" if tail else "")
    code = text[start:end]
    new = head + opening + code + closing + tail
    s = len(head) + len(opening)
    return new, s, s + len(code)


def insert_block(text, pos, block):
    """Inserts a block (rule, table, image line) as its own paragraph at pos; returns (text, cursor after it)."""
    head, tail = text[:pos], text[pos:]
    before = "" if not head else "\n\n" if not head.endswith("\n") else "" if head.endswith("\n\n") else "\n"
    after = "" if not tail else "\n\n" if not tail.startswith("\n") else ""
    new = head + before + block + after + tail
    return new, len(head) + len(before) + len(block)


def table_template():
    return "| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |"


def _label(text):
    return text.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def _url(url):
    return url.strip().replace(" ", "%20").replace("(", "%28").replace(")", "%29")


def link(label, url):
    return f"[{_label(label)}]({_url(url)})"


def app_link(label, target):
    """A link to an app page (coffer://…), from the app-link dialog."""
    return link(label, target)


def image(name, alt=""):
    """A content image uploaded to the news store."""
    return f"![{_label(alt)}](coffer-image:{name})"
