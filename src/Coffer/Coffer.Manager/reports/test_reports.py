"""Tests for the admin report client and formatting (no network, no window).

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest reports.test_reports -v
"""
import unittest

from reports.api import AdminApi, ApiError
from reports.formatting import format_report, short_row


class FakeResponse:
    def __init__(self, status, payload=None, content=b""):
        self.status_code = status
        self._payload = payload
        self.content = content
        self.ok = 200 <= status < 300

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def request(self, method, url, headers=None, params=None, json=None, timeout=None):
        self.calls.append({"method": method, "url": url, "headers": headers, "params": params, "json": json, "timeout": timeout})
        return self.response


class AdminApiTests(unittest.TestCase):
    def test_list_sends_bearer_token_and_filters(self):
        session = FakeSession(FakeResponse(200, []))
        api = AdminApi("http://localhost:5141/", "tok", session=session)

        api.list_reports(status="open", target_type="listing")

        call = session.calls[0]
        self.assertEqual("GET", call["method"])
        self.assertEqual("http://localhost:5141/api/Admin/Reports", call["url"])
        self.assertEqual("Bearer tok", call["headers"]["Authorization"])
        self.assertEqual({"status": "open", "targetType": "listing"}, call["params"])

    def test_list_omits_empty_filters(self):
        session = FakeSession(FakeResponse(200, []))
        AdminApi("http://x", "t", session=session).list_reports(status=None, target_type=None)
        self.assertEqual({}, session.calls[0]["params"])

    def test_resolve_posts_decision_rule_and_statement(self):
        session = FakeSession(FakeResponse(200, {"id": "r1"}))
        AdminApi("http://x", "t", session=session).resolve("r1", "removed", "spam", "Spam listing posted many times.")

        call = session.calls[0]
        self.assertEqual("POST", call["method"])
        self.assertEqual("http://x/api/Admin/Reports/r1/Resolve", call["url"])
        self.assertEqual({"decision": "removed", "rule": "spam", "statement": "Spam listing posted many times."}, call["json"])

    def test_error_uses_backend_message(self):
        session = FakeSession(FakeResponse(403, {"message": "Admins only."}))
        with self.assertRaises(ApiError) as ctx:
            AdminApi("http://x", "t", session=session).get_report("r1")
        self.assertEqual(403, ctx.exception.status)
        self.assertEqual("Admins only.", str(ctx.exception))

    def test_unauthorized_without_body_has_helpful_message(self):
        session = FakeSession(FakeResponse(401))
        with self.assertRaises(ApiError) as ctx:
            AdminApi("http://x", "bad", session=session).rules()
        self.assertIn("token", str(ctx.exception).lower())

    def test_listing_image_returns_bytes(self):
        session = FakeSession(FakeResponse(200, content=b"\xff\xd8\xff"))
        data = AdminApi("http://x", "t", session=session).listing_image("a_1.jpg")
        self.assertEqual(b"\xff\xd8\xff", data)
        self.assertEqual("http://x/api/Listings/Image/a_1.jpg", session.calls[0]["url"])


REPORT = {
    "id": "r1", "targetType": "message", "rule": "scam_or_fraud", "reason": "Asked for my bank password",
    "targetSummary": "Send me your bank password", "status": "open", "decision": None, "statement": None,
    "reporter": {"id": "u1", "name": "Alice"}, "targetOwner": {"id": "u2", "name": "Bob"},
    "ownerPriorRemovals": 2, "openReportsOnTarget": 1, "createdAt": "2026-11-14T10:00:00Z",
    "snapshot": {
        "message": {"sender": "Bob", "kind": "text", "body": "Send me your bank password", "createdAt": "2026-11-14T09:59:00Z"},
        "listing": {"id": "l1", "title": "Beer caps", "status": "active"},
        "transcript": [
            {"sender": "Alice", "kind": "text", "body": "Hi", "createdAt": "2026-11-14T09:58:00Z", "isRemoved": False},
            {"sender": "Bob", "kind": "price_offer", "body": "", "amountCents": 1250, "status": "pending", "createdAt": "2026-11-14T09:58:30Z", "isRemoved": False},
        ],
    },
    "currentState": {"exists": True, "isRemoved": False, "body": "Send me your bank password"},
}


class FormattingTests(unittest.TestCase):
    def test_format_message_report_contains_evidence_and_context(self):
        text = format_report(REPORT, {"scam_or_fraud": "Scam or fraud attempt"})
        self.assertIn("Scam or fraud attempt", text)
        self.assertIn("Alice", text)
        self.assertIn("Bob", text)
        self.assertIn("removals so far: 2", text)
        self.assertIn("Send me your bank password", text)
        self.assertIn("Beer caps", text)
        self.assertIn("€12.50", text)

    def test_short_row(self):
        row = short_row(REPORT | {"targetOwner": {"name": "Bob"}, "reporter": {"name": "Alice"}}, {"scam_or_fraud": "Scam"})
        self.assertEqual(("2026-11-14 10:00", "message", "Scam", "Send me your bank password", "Alice", "Bob", "open"), row)


if __name__ == "__main__":
    unittest.main()
