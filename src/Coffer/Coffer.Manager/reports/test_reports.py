"""Tests for the Manager's admin client, sign-in, decision logic and formatting (no network, no window).

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest reports.test_reports -v
"""
import unittest

from reports.api import AdminApi, ApiError, ManagerAuth
from reports.formatting import content_row, format_content, format_report, format_suspension, short_row
from reports.resolution import decision_payload, validate
import os
from unittest import mock

from reports.session import Session, configured_api_url


class FakeResponse:
    def __init__(self, status, payload=None, content=b""):
        self.status_code = status
        self._payload = payload
        self.content = content if content else (b"{}" if payload is not None else b"")
        self.ok = 200 <= status < 300

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, headers=None, params=None, json=None, timeout=None):
        self.calls.append({"method": method, "url": url, "headers": headers, "params": params, "json": json})
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]


PAGE = {"items": [], "page": 1, "pageSize": 100, "total": 0}


class AdminApiTests(unittest.TestCase):
    def test_list_sends_manager_token_and_filters(self):
        session = FakeSession(FakeResponse(200, PAGE))
        api = AdminApi("http://localhost:5141/", "tok", session=session)

        api.list_reports(status="open", target_type="comment")

        call = session.calls[0]
        self.assertEqual("http://localhost:5141/api/Admin/Reports", call["url"])
        self.assertEqual("Bearer tok", call["headers"]["Authorization"])
        self.assertEqual({"status": "open", "targetType": "comment", "page": 1, "pageSize": 100}, call["params"])

    def test_all_filters_are_omitted(self):
        session = FakeSession(FakeResponse(200, PAGE))
        AdminApi("http://x", "t", session=session).list_content(status="all", target_type="all")
        self.assertEqual({"page": 1, "pageSize": 100}, session.calls[0]["params"])
        self.assertEqual("http://x/api/Admin/ReportedContent", session.calls[0]["url"])

    def test_resolve_many_posts_ids_decision_and_one_statement(self):
        session = FakeSession(FakeResponse(200, {"resolvedCount": 2}))
        AdminApi("http://x", "t", session=session).resolve_many(["r1", "r2"], "suspended", None, "Harassment in comments.", 72)

        call = session.calls[0]
        self.assertEqual("http://x/api/Admin/Reports/Resolve", call["url"])
        self.assertEqual({"reportIds": ["r1", "r2"], "decision": "suspended", "rule": None,
                          "statement": "Harassment in comments.", "suspensionHours": 72}, call["json"])

    def test_resolve_content_targets_the_group(self):
        session = FakeSession(FakeResponse(200, {"resolvedCount": 3}))
        AdminApi("http://x", "t", session=session).resolve_content("item", "i1", "no_violation", None, "Allowed content here.")
        self.assertEqual("http://x/api/Admin/ReportedContent/item/i1/Resolve", session.calls[0]["url"])

    def test_suspension_endpoints(self):
        session = FakeSession(FakeResponse(200, {"id": "s1"}))
        api = AdminApi("http://x", "t", session=session)
        api.suspend("u1", 24, "Spam in every comment.")
        api.revoke("s1", "Appeal accepted.")
        self.assertEqual({"userId": "u1", "durationHours": 24, "reason": "Spam in every comment."}, session.calls[0]["json"])
        self.assertEqual("http://x/api/Admin/Suspensions/s1/Revoke", session.calls[1]["url"])

    def test_error_uses_backend_message_and_code(self):
        session = FakeSession(FakeResponse(503, {"message": "No admins configured.", "code": "admin_provisioning_required"}))
        with self.assertRaises(ApiError) as ctx:
            ManagerAuth("http://x", session=session).start()
        self.assertEqual(503, ctx.exception.status)
        self.assertEqual("admin_provisioning_required", ctx.exception.code)

    def test_unauthorized_without_body_has_helpful_message(self):
        session = FakeSession(FakeResponse(401))
        with self.assertRaises(ApiError) as ctx:
            AdminApi("http://x", "bad", session=session).rules()
        self.assertIn("sign in", str(ctx.exception).lower())

    def test_image_uses_admin_endpoint(self):
        session = FakeSession(FakeResponse(200, content=b"\xff\xd8\xff"))
        data = AdminApi("http://x", "t", session=session).image("item", "a_1.jpg")
        self.assertEqual(b"\xff\xd8\xff", data)
        self.assertEqual("http://x/api/Admin/Images/item/a_1.jpg", session.calls[0]["url"])

    def test_sign_in_calls_send_no_token(self):
        session = FakeSession(FakeResponse(200, {"status": "pending"}))
        ManagerAuth("http://x", session=session).poll("dev-1")
        self.assertEqual({}, session.calls[0]["headers"])
        self.assertEqual({"deviceCode": "dev-1"}, session.calls[0]["json"])


class SessionTests(unittest.TestCase):
    def test_expired_or_revoked_session_signs_out(self):
        signed_out = []
        s = Session("http://x")
        s.on_signed_out = lambda: signed_out.append(True)
        s.sign_in("tok", {"login": "octo"}, None)

        self.assertFalse(s.handle(ApiError(400, "bad input")))
        self.assertTrue(s.signed_in)
        self.assertTrue(s.handle(ApiError(401, "expired")))
        self.assertFalse(s.signed_in)
        self.assertEqual([True], signed_out)


class ApiUrlTests(unittest.TestCase):
    def test_url_comes_from_env_and_missing_is_reported(self):
        with mock.patch.dict(os.environ, {"COFFER_API_URL": " http://api.test:5141/ "}):
            self.assertEqual("http://api.test:5141", configured_api_url())
        with mock.patch.dict(os.environ, {"COFFER_API_URL": ""}):
            self.assertIsNone(configured_api_url())


class DecisionTests(unittest.TestCase):
    def test_payloads(self):
        self.assertEqual(("removed", None), decision_payload("removed", "3 days"))
        self.assertEqual(("removed", 72), decision_payload("removed+suspend", "3 days"))
        self.assertEqual(("suspended", 168), decision_payload("suspended", "7 days"))
        self.assertEqual(("no_violation", None), decision_payload("no_violation", "7 days"))

    def test_explanation_is_required_for_every_decision(self):
        for choice in ("removed", "suspended", "no_violation"):
            self.assertIsNotNone(validate(choice, ""))
            self.assertIsNotNone(validate(choice, "too short"))
            self.assertIsNone(validate(choice, "A proper explanation."))


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

COMMENT_DETAIL = {
    "content": {"targetType": "comment", "targetId": "c1", "targetSummary": "Buy cheap caps", "owner": {"name": "Feri"},
                "reportCount": 2, "openCount": 2, "rules": ["spam"], "reporters": [{"name": "Anna"}, {"name": "Gelo"}],
                "statuses": {"open": 2}, "latestReportAt": "2026-11-14T11:00:00Z"},
    "reports": [
        {"id": "a", "reporter": {"name": "Anna"}, "rule": "spam", "status": "open", "reason": "Shop advert", "createdAt": "2026-11-14T11:00:00Z"},
        {"id": "b", "reporter": {"name": "Gelo"}, "rule": "spam", "status": "open", "reason": "Spam link", "createdAt": "2026-11-14T10:00:00Z"},
    ],
    "ownerPriorRemovals": 1,
    "ownerActiveSuspension": {"endsAt": "2026-11-17T10:00:00Z"},
    "latestSnapshot": {
        "comment": {"id": "c1", "author": "Feri", "body": "Buy cheap caps", "createdAt": "2026-11-14T09:00:00Z"},
        "item": {"description": "Edelweiss cap", "collection": "Beer caps"},
        "thread": [{"id": "c1", "author": "Feri", "body": "Buy cheap caps", "createdAt": "2026-11-14T09:00:00Z"}],
    },
    "currentState": {"exists": True, "isRemoved": False},
}


class FormattingTests(unittest.TestCase):
    def test_format_message_report_contains_evidence_and_context(self):
        text = format_report(REPORT, {"scam_or_fraud": "Scam or fraud attempt"})
        for expected in ("Scam or fraud attempt", "Alice", "Bob", "removals so far: 2", "Send me your bank password", "Beer caps", "€12.50"):
            self.assertIn(expected, text)

    def test_short_row(self):
        row = short_row(REPORT, {"scam_or_fraud": "Scam"})
        self.assertEqual(("2026-11-14 10:00", "message", "Scam", "Send me your bank password", "Alice", "Bob", "open"), row)

    def test_grouped_content_row_and_detail(self):
        labels = {"spam": "Spam or advertising"}
        row = content_row(COMMENT_DETAIL["content"], labels)
        self.assertEqual(("comment", "Buy cheap caps", "Feri", 2, 2, "Spam or advertising", "Anna, Gelo", "open:2", "2026-11-14 11:00"), row)

        text = format_content(COMMENT_DETAIL, labels)
        self.assertIn("2 report(s), 2 open", text)
        self.assertIn("SUSPENDED until 2026-11-17 10:00", text)
        self.assertIn("Shop advert", text)
        self.assertIn("<-- reported", text)
        self.assertIn("On item: Edelweiss cap", text)

    def test_format_suspension(self):
        text = format_suspension({"status": "revoked", "user": {"name": "Feri"}, "startsAt": "2026-11-14T10:00:00Z",
                                  "endsAt": "2026-11-17T10:00:00Z", "createdBy": {"login": "octo"}, "reason": "Scam messages.",
                                  "revokedAt": "2026-11-15T10:00:00Z", "revokedBy": {"login": "octo"}, "revokeReason": "Appeal."})
        self.assertIn("REVOKED", text)
        self.assertIn("Appeal.", text)


if __name__ == "__main__":
    unittest.main()
