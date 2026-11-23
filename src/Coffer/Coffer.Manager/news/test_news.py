"""Tests for the News tab's pure parts: markdown editing helpers, the preview's segments and the admin client calls.

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import os
import tempfile
import unittest

from news.markdown_tools import app_link, code_block, image, insert_block, link, prefix_lines, table_template, wrap
from news.preview import segments
from reports.api import AdminApi


class FakeResponse:
    def __init__(self, status, payload=None, content=None):
        self.status_code = status
        self._payload = payload
        self.content = content if content is not None else (b"{}" if payload is not None else b"")
        self.ok = 200 <= status < 300

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append({"method": method, "url": url, **kwargs})
        return self.response


def tags_of(markdown, needle):
    """The tags of the first segment containing needle."""
    for text, tags in segments(markdown):
        if needle in text:
            return tags
    raise AssertionError(f"{needle!r} not in the preview")


class MarkdownToolTests(unittest.TestCase):
    def test_wrap_toggles_bold(self):
        text, s, e = wrap("make this bold", 10, 14, "**", "**")
        self.assertEqual("make this **bold**", text)
        self.assertEqual("bold", text[s:e])
        # Wrapping the same selection again removes the markers.
        text, s, e = wrap(text, s, e, "**", "**")
        self.assertEqual("make this bold", text)
        self.assertEqual("bold", text[s:e])
        # Also when the markers are selected with the word.
        text, s, e = wrap("a **b** c", 2, 7, "**", "**")
        self.assertEqual(("a b c", "b"), (text, text[s:e]))
        # No selection: markers inserted, cursor between them.
        text, s, e = wrap("ab", 1, 1, "*", "*")
        self.assertEqual(("a**b", 2, 2), (text, s, e))

    def test_prefix_lines_numbers_lists(self):
        text, s, e = prefix_lines("one\ntwo\nthree", 0, 13, "1. ")
        self.assertEqual("1. one\n2. two\n3. three", text)
        self.assertEqual(text, text[s:e])
        # Applying it again removes the numbers.
        self.assertEqual("one\ntwo\nthree", prefix_lines(text, s, e, "1. ")[0])
        # Only the lines the selection touches; a heading replaces another heading.
        self.assertEqual("intro\n## Title\nend", prefix_lines("intro\n# Title\nend", 8, 8, "## ")[0])
        self.assertEqual("- a\n- b", prefix_lines("a\nb", 0, 3, "- ")[0])
        self.assertEqual("> quoted", prefix_lines("quoted", 0, 0, "> ")[0])

    def test_code_block_wraps_selection(self):
        text, s, e = code_block("see:\nx = 1\ndone", 5, 10)
        self.assertEqual("see:\n```\nx = 1\n```\ndone", text)
        self.assertEqual("x = 1", text[s:e])
        # Mid-line selections get their own lines.
        text, _, _ = code_block("abc", 1, 2)
        self.assertEqual("a\n```\nb\n```\nc", text)

    def test_image_and_links(self):
        self.assertEqual("![](coffer-image:0123456789abcdef0123456789abcdef.jpg)", image("0123456789abcdef0123456789abcdef.jpg"))
        self.assertEqual("![A coin](coffer-image:x.png)", image("x.png", "A coin"))
        self.assertEqual("[Coffer](https://example.com/a%20b)", link("Coffer", "https://example.com/a b"))
        self.assertEqual("[a \\[b\\]](https://x.y/%28c%29)", link("a [b]", "https://x.y/(c)"))
        self.assertEqual("[Stats](coffer://community/stats)", app_link("Stats", "coffer://community/stats"))
        self.assertIn("| --- | --- |", table_template())
        text, pos = insert_block("ab", 1, "---")
        self.assertEqual("a\n\n---\n\nb", text)
        self.assertEqual(text.index("---") + 3, pos)


class PreviewTests(unittest.TestCase):
    def test_preview_segments_cover_common_formatting(self):
        md = (
            "# Big\n\n## Medium\n\n### Small\n\n"
            "Some **bold**, *italic*, ~~gone~~ and `code`.\n\n"
            "> wise words\n\n- first\n- second\n\n1. one\n2. two\n\n"
            "```\nx = 1\n```\n\n---\n\n"
            "[a link](coffer://item/3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b)\n\n"
            "![pic](coffer-image:0123456789abcdef0123456789abcdef.jpg)\n\n"
            "| A | B |\n| --- | --- |\n| 1 | 2 |\n"
        )
        self.assertIn("h1", tags_of(md, "Big"))
        self.assertIn("h2", tags_of(md, "Medium"))
        self.assertIn("h3", tags_of(md, "Small"))
        self.assertIn("bold", tags_of(md, "bold"))
        self.assertIn("italic", tags_of(md, "italic"))
        self.assertIn("strike", tags_of(md, "gone"))
        self.assertIn("code", tags_of(md, "code"))
        self.assertIn("quote", tags_of(md, "wise words"))
        self.assertIn("bullet", tags_of(md, "•"))
        self.assertIn("1.", "".join(t for t, _ in segments(md)))
        self.assertIn("codeblock", tags_of(md, "x = 1"))
        self.assertIn("rule", tags_of(md, "─"))
        self.assertIn("link:coffer://item/3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b", tags_of(md, "a link"))
        self.assertIn("image:0123456789abcdef0123456789abcdef.jpg", [t for _, tags in segments(md) for t in tags])
        self.assertIn("table", tags_of(md, "1 │ 2"))
        self.assertIn("bold", tags_of(md, "A │ B"))
        # Paragraph text is untagged.
        self.assertEqual((), tags_of(md, "Some "))

    def test_preview_never_renders_html(self):
        md = "<script>alert(1)</script>\n\nhi <b>there</b>"
        out = segments(md)
        text = "".join(t for t, _ in out)
        self.assertIn("<script>alert(1)</script>", text)
        self.assertIn("<b>there</b>", text)
        self.assertTrue(all(tags == () for t, tags in out if "<" in t))

    def test_preview_drops_outside_images(self):
        tags = [t for _, ts in segments("![x](https://tracker.example/p.gif)") for t in ts]
        self.assertFalse(any(t.startswith("image:") for t in tags))


class NewsApiTests(unittest.TestCase):
    def test_api_news_routes(self):
        session = FakeSession(FakeResponse(200, {"id": "n1"}))
        api = AdminApi("http://x", "tok", session=session)

        api.news(status="draft", page=2)
        api.news_post("n1")
        api.create_news({"title": "T", "heroImage": None, "content": "c"})
        api.update_news("n1", {"title": "T2", "heroImage": None, "content": "c"})
        api.publish_news("n1", True)
        api.delete_news("n1")
        api.link_targets("collection", "roman")

        calls = [(c["method"], c["url"]) for c in session.calls]
        self.assertEqual([
            ("GET", "http://x/api/Admin/News"),
            ("GET", "http://x/api/Admin/News/n1"),
            ("POST", "http://x/api/Admin/News"),
            ("PUT", "http://x/api/Admin/News/n1"),
            ("POST", "http://x/api/Admin/News/n1/Publish"),
            ("DELETE", "http://x/api/Admin/News/n1"),
            ("GET", "http://x/api/Admin/News/LinkTargets"),
        ], calls)
        self.assertEqual({"status": "draft", "page": 2, "pageSize": 100}, session.calls[0]["params"])
        self.assertEqual({"title": "T2", "heroImage": None, "content": "c"}, session.calls[3]["json"])
        self.assertEqual({"published": True}, session.calls[4]["json"])
        self.assertEqual({"type": "collection", "query": "roman"}, session.calls[6]["params"])
        self.assertTrue(all(c["headers"]["Authorization"] == "Bearer tok" for c in session.calls))

    def test_upload_news_image_is_multipart_with_long_timeout(self):
        folder = tempfile.mkdtemp()
        path = os.path.join(folder, "banner.png")
        with open(path, "wb") as f:
            f.write(b"\x89PNG")
        session = FakeSession(FakeResponse(200, {"fileName": "0123456789abcdef0123456789abcdef.png"}))

        name = AdminApi("http://x", "tok", session=session).upload_news_image(path)

        call = session.calls[0]
        self.assertEqual("0123456789abcdef0123456789abcdef.png", name)
        self.assertEqual(("POST", "http://x/api/Admin/News/Images"), (call["method"], call["url"]))
        self.assertEqual({"file"}, set(call["files"].keys()))
        self.assertGreaterEqual(call["timeout"], 60)

    def test_news_image_downloads_bytes(self):
        session = FakeSession(FakeResponse(200, content=b"\xff\xd8jpeg"))
        data = AdminApi("http://x", "tok", session=session).news_image("0123456789abcdef0123456789abcdef.jpg")
        self.assertEqual(b"\xff\xd8jpeg", data)
        self.assertEqual("http://x/api/News/Image/0123456789abcdef0123456789abcdef.jpg", session.calls[0]["url"])


if __name__ == "__main__":
    unittest.main()
