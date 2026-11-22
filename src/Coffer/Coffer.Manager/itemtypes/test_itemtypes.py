"""Tests for the item type tab's pure parts: translation JSON boxes and the admin client calls (no network, no window).

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest discover -v
"""
import json
import os
import tempfile
import unittest

from itemtypes.translations import parse, placeholder, to_text
from reports.api import AdminApi, ApiError


class FakeResponse:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload
        self.content = b"{}" if payload is not None else b""
        self.ok = 200 <= status < 300

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append({"method": method, "url": url, **kwargs})
        return self.response


class TranslationBoxTests(unittest.TestCase):
    def test_placeholder_examples(self):
        self.assertEqual({"hu": "Kupak"}, json.loads(placeholder("name")))
        self.assertIn("hu", json.loads(placeholder("description")))
        options = json.loads(placeholder("options", ["Logo", "Flag", "Landscape"]))
        self.assertEqual(3, len(options["hu"].split(";")))

    def test_empty_text_and_placeholder_parse_to_empty(self):
        self.assertEqual({}, parse(""))
        self.assertEqual({}, parse("   \n"))
        self.assertEqual({}, parse(placeholder("name")))
        self.assertEqual({}, parse(placeholder("options", ["A", "B"]), part_count=2))

    def test_parse_rejects_bad_json_and_keys(self):
        for bad in ['{"hu": "Kupak"', '["hu"]', '{"en": "Cap"}', '{"HU": "Kupak"}', '{"hun": "Kupak"}', '{"hu": ""}', '{"hu": 3}']:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                parse(bad)

    def test_parse_checks_option_part_count(self):
        self.assertEqual({"hu": "Logó;Zászló"}, parse('{"hu": "Logó; Zászló"}', part_count=2))
        with self.assertRaises(ValueError):
            parse('{"hu": "Logó"}', part_count=2)
        with self.assertRaises(ValueError):
            parse('{"hu": "Logó;;Címer"}', part_count=3)

    def test_to_text_roundtrip(self):
        self.assertEqual("", to_text({}))
        self.assertEqual("", to_text(None))
        self.assertEqual({"hu": "Kupak", "de": "Kronkorken"}, parse(to_text({"hu": "Kupak", "de": "Kronkorken"})))


class ItemTypeApiTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def file(self, name, data=b"PK\x03\x04model"):
        path = os.path.join(self.dir, name)
        with open(path, "wb") as f:
            f.write(data)
        return path

    def test_upload_models_sends_multipart(self):
        session = FakeSession(FakeResponse(200, {"id": 3}))
        api = AdminApi("http://x", "tok", session=session)

        api.upload_models(3, detection_path=self.file("best.pt"), embedding_path=self.file("emb.pt"), class_count=60)

        call = session.calls[0]
        self.assertEqual(("POST", "http://x/api/Admin/ItemTypes/3/Models"), (call["method"], call["url"]))
        self.assertEqual({"detection", "embedding"}, set(call["files"].keys()))
        self.assertEqual({"classCount": "60"}, call["data"])
        self.assertEqual("Bearer tok", call["headers"]["Authorization"])
        self.assertGreaterEqual(call["timeout"], 600)
        self.assertIsNone(call.get("json"))

    def test_upload_icon_sends_the_file(self):
        session = FakeSession(FakeResponse(200, {"id": 3, "icon": "3_20261122103000.png"}))
        AdminApi("http://x", "tok", session=session).upload_icon(3, self.file("icon.png", b"\x89PNG"))
        call = session.calls[0]
        self.assertEqual("http://x/api/Admin/ItemTypes/3/Icon", call["url"])
        self.assertEqual({"file"}, set(call["files"].keys()))

    def test_set_published_body(self):
        session = FakeSession(FakeResponse(200, {"id": 3, "published": True}))
        AdminApi("http://x", "t", session=session).set_published(3, True)
        self.assertEqual("http://x/api/Admin/ItemTypes/3/Publish", session.calls[0]["url"])
        self.assertEqual({"published": True}, session.calls[0]["json"])

    def test_item_type_and_option_set_routes(self):
        session = FakeSession(FakeResponse(200, {"id": 1}))
        api = AdminApi("http://x", "t", session=session)
        api.update_item_type(1, {"name": "Cap"})
        api.add_attribute(1, {"name": "Brand"})
        api.update_attribute(5, {"name": "Brand"})
        api.delete_attribute(5)
        api.update_option_set(2, {"options": []})
        self.assertEqual(
            [("PUT", "http://x/api/Admin/ItemTypes/1"), ("POST", "http://x/api/Admin/ItemTypes/1/Attributes"),
             ("PUT", "http://x/api/Admin/Attributes/5"), ("DELETE", "http://x/api/Admin/Attributes/5"),
             ("PUT", "http://x/api/Admin/OptionSets/2")],
            [(c["method"], c["url"]) for c in session.calls])

    def test_admin_errors_surface_message(self):
        session = FakeSession(FakeResponse(409, {"code": "attributeInUse", "message": "20 item(s) have a value for this attribute."}))
        with self.assertRaises(ApiError) as caught:
            AdminApi("http://x", "t", session=session).delete_attribute(1)
        self.assertEqual(("attributeInUse", 409), (caught.exception.code, caught.exception.status))
        self.assertIn("20 item(s)", str(caught.exception))


if __name__ == "__main__":
    unittest.main()


class FormattingTests(unittest.TestCase):
    TYPE = {
        "id": 2, "name": "Stamp", "published": False, "collections": 0, "listings": 1,
        "detection": {"fileName": "2_detection.pt", "bytes": 6_291_456, "classCount": None},
        "embedding": None,
        "publishBlockers": ["itemTypeNeedsModels", "itemTypeNeedsIcon"],
    }

    def test_type_row(self):
        from itemtypes.formatting import type_row
        self.assertEqual(("Stamp", "hidden", "detection only", "0 / 1"), type_row(self.TYPE))

    def test_models_and_blockers_text(self):
        from itemtypes.formatting import blockers_text, models_text
        self.assertEqual("Detection: 2_detection.pt (6.0 MB) · Embedding: missing", models_text(self.TYPE))
        self.assertEqual("Can't publish yet: upload both AI models, upload an icon.", blockers_text(self.TYPE))
        self.assertEqual("Ready to publish.", blockers_text({**self.TYPE, "publishBlockers": []}))

    def test_attribute_row_names_the_data_type(self):
        from itemtypes.formatting import attribute_row
        row = attribute_row({"name": "Features", "dataType": 5, "primary": False, "required": False, "optionSetId": 1, "usedByItems": 14})
        self.assertEqual(("Features", "Multi-select", "", "", "set #1", "14 items"), row)
