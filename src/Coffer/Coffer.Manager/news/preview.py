"""The News editor's preview: markdown → (text, tags) segments that the view draws into a read-only Text widget.

HTML is disabled, so tags like <script> stay visible as text, just as the app shows them. Images are tagged
"image:{name}" only when they come from the news store (coffer-image:…); anything else is shown as a note, never loaded.
"""
import re

from markdown_it import MarkdownIt

_md = MarkdownIt("commonmark", {"html": False}).enable(["table", "strikethrough"])
_STORE_IMAGE = re.compile(r"^coffer-image:([0-9a-f]{32}\.(?:jpg|png))$")
_INLINE = {"strong": "bold", "em": "italic", "s": "strike"}
RULE = "─" * 40


class _Out:
    def __init__(self):
        self.parts = []

    def add(self, text, tags=()):
        if not text:
            return
        tags = tuple(tags)
        if self.parts and self.parts[-1][1] == tags:
            self.parts[-1] = (self.parts[-1][0] + text, tags)
        else:
            self.parts.append((text, tags))

    def ends_with_newline(self):
        return not self.parts or self.parts[-1][0].endswith("\n")


def _inline(children, out, base):
    active = []
    href = []
    for tok in children or []:
        kind = tok.type
        if kind.endswith("_open") and kind[:-5] in _INLINE:
            active.append(_INLINE[kind[:-5]])
        elif kind.endswith("_close") and kind[:-6] in _INLINE:
            if _INLINE[kind[:-6]] in active:
                active.remove(_INLINE[kind[:-6]])
        elif kind == "link_open":
            href.append(f"link:{tok.attrGet('href') or ''}")
        elif kind == "link_close":
            if href:
                href.pop()
        elif kind == "text":
            out.add(tok.content, base + active + href[-1:])
        elif kind == "code_inline":
            out.add(tok.content, base + ["code"])
        elif kind == "softbreak":
            out.add(" ", base + active)
        elif kind == "hardbreak":
            out.add("\n", base)
        elif kind == "image":
            match = _STORE_IMAGE.match(tok.attrGet("src") or "")
            if match:
                out.add("\n", base)
                out.add(" ", base + [f"image:{match.group(1)}"])
                out.add("\n", base)
            else:
                out.add("[image from outside the news store: not shown in the app]", base + ["italic"])
        else:
            # html_inline cannot occur (HTML is off); anything unknown is shown as its source text.
            if tok.content:
                out.add(tok.content, base + active)


def _table(tokens, i, out, base):
    """Draws a table as aligned rows; returns the index after table_close."""
    rows, row, cell = [], None, None
    header_rows = 0
    in_head = False
    while i < len(tokens) and tokens[i].type != "table_close":
        tok = tokens[i]
        if tok.type == "thead_open":
            in_head = True
        elif tok.type == "thead_close":
            in_head = False
        elif tok.type == "tr_open":
            row = []
        elif tok.type == "tr_close":
            rows.append(row)
            if in_head:
                header_rows += 1
        elif tok.type == "inline":
            row.append(tok.content.strip())
        i += 1
    widths = [max((len(r[c]) if c < len(r) else 0) for r in rows) for c in range(max((len(r) for r in rows), default=0))]
    for n, r in enumerate(rows):
        line = " │ ".join((r[c] if c < len(r) else "").ljust(widths[c]) for c in range(len(widths)))
        out.add(line + "\n", base + ["table"] + (["bold"] if n < header_rows else []))
        if n == header_rows - 1:
            out.add("─┼─".join("─" * w for w in widths) + "\n", base + ["table"])
    out.add("\n", base)
    return i + 1


def segments(markdown):
    """[(text, tags), …] for the preview; tags from h1–h3, bold, italic, strike, code, codeblock, quote, bullet,
    link:{href}, rule, image:{name}, table."""
    tokens = _md.parse(markdown or "")
    out = _Out()
    quote = 0
    lists = []  # stack of [ordered, next number]
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        kind = tok.type
        base = ["quote"] if quote else []
        if kind == "heading_open":
            level = min(int(tok.tag[1]), 3)
            _inline(tokens[i + 1].children, out, base + [f"h{level}"])
            out.add("\n\n", base)
            i += 3
            continue
        if kind == "blockquote_open":
            quote += 1
        elif kind == "blockquote_close":
            quote -= 1
        elif kind in ("bullet_list_open", "ordered_list_open"):
            lists.append([kind == "ordered_list_open", int(tok.attrGet("start") or 1)])
        elif kind in ("bullet_list_close", "ordered_list_close"):
            lists.pop()
            if not lists:
                out.add("\n", base)
        elif kind == "list_item_open":
            indent = "    " * (len(lists) - 1)
            ordered, number = lists[-1]
            if ordered:
                out.add(f"{indent}{number}. ", base)
                lists[-1][1] += 1
            else:
                out.add(f"{indent}• ", base + ["bullet"])
        elif kind == "inline":
            _inline(tok.children, out, base)
        elif kind == "paragraph_close":
            out.add("\n" if lists and tok.hidden else "\n\n", base)
        elif kind in ("fence", "code_block"):
            code = tok.content if tok.content.endswith("\n") else tok.content + "\n"
            out.add(code, base + ["codeblock"])
            out.add("\n", base)
        elif kind == "hr":
            out.add(RULE, base + ["rule"])
            out.add("\n\n", base)
        elif kind == "table_open":
            i = _table(tokens, i + 1, out, base)
            continue
        elif kind == "html_block":
            out.add(tok.content, base)
        i += 1
    return out.parts
