"""Tests for the Contribution tab's pure parts and its admin client calls.

Run from Coffer.Manager:  venv\Scripts\python.exe -m unittest contribution.test_contribution -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from contribution.logic import (REASONS, format_local, most_recent_source_id, parse_local, phase_label, phone_preview,
                                state_label, winner_sources)
from reports.api import AdminApi


class FakeResponse:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload
        self.content = b"{}" if payload is not None else b""
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


def vote(phase_id, state="closed", winner=None, closed_at=None, names=("Coins", "Stamps", "Pins"), active=False):
    return {"id": phase_id, "kind": "vote", "state": state, "active": active, "winnerCandidateId": winner,
            "closedAt": closed_at, "candidates": [{"id": f"{phase_id}-{i}", "name": n} for i, n in enumerate(names)]}


class LogicTests(unittest.TestCase):
    def test_parse_local_round_trips(self):
        self.assertEqual("2026-12-10 20:00", format_local(parse_local("2026-12-10 20:00").isoformat()))

    def test_parse_local_is_utc_aware(self):
        self.assertEqual(timezone.utc, parse_local("2026-12-10 20:00").tzinfo)

    def test_parse_local_rejects_garbage(self):
        for text in ("10/12/2026", "2026-12-10", "", "2026-13-10 20:00"):
            with self.assertRaises(ValueError):
                parse_local(text)

    def test_format_local_empty(self):
        self.assertEqual("", format_local(None))

    def test_vote_label_lists_candidates(self):
        self.assertEqual("Vote: Coins / Stamps / Pins", phase_label(vote("a")))

    def test_photo_label_names_subject(self):
        self.assertEqual("Photos: Stamps", phase_label({"kind": "photo", "subject": {"name": "Stamps"}}))
        self.assertEqual("Photos: (no subject)", phase_label({"kind": "photo", "subject": None}))

    def test_paused_label(self):
        self.assertEqual("open (paused)", state_label({"state": "open", "active": False}))
        self.assertEqual("open", state_label({"state": "open", "active": True}))
        self.assertEqual("closed", state_label({"state": "closed", "active": False}))

    def test_winner_sources_newest_first_and_skip_ties(self):
        phases = [
            vote("old", winner="old-0", closed_at="2026-10-01T10:00:00Z"),
            vote("tie", winner=None, closed_at="2026-12-01T10:00:00Z"),
            vote("new", winner="new-1", closed_at="2026-11-01T10:00:00Z"),
            vote("open", state="open"),
            {"id": "p", "kind": "photo", "state": "closed", "winnerCandidateId": None, "closedAt": "2026-12-05T10:00:00Z"},
        ]
        self.assertEqual(["new", "old"], [p["id"] for p in winner_sources(phases)])

    def test_most_recent_source(self):
        phases = [vote("old", winner="old-0", closed_at="2026-10-01T10:00:00Z"),
                  vote("new", winner="new-1", closed_at="2026-11-01T10:00:00Z")]
        self.assertEqual("new", most_recent_source_id(phases))
        self.assertIsNone(most_recent_source_id([vote("x", state="open")]))

    def test_phone_preview_off_shows_reason(self):
        preview = phone_preview({"enabled": False, "reason": "modelsInProgress"}, None, datetime.now(timezone.utc))
        self.assertEqual("No contribution period right now — " + dict(REASONS)["modelsInProgress"], preview)

    def test_phone_preview_on_shows_time_left(self):
        now = datetime(2026, 12, 1, 12, 0, tzinfo=timezone.utc)
        phase = vote("a", state="open", active=True)
        phase["endsAt"] = (now + timedelta(days=3, hours=14, minutes=22)).isoformat()
        preview = phone_preview({"enabled": True, "reason": None}, phase, now)
        self.assertEqual("3 d 14:22 left — Vote: Coins / Stamps / Pins", preview)

    def test_reasons_are_the_four_keys(self):
        self.assertEqual(["justFinished", "communityTooSmall", "contributionFinished", "modelsInProgress"], [k for k, _ in REASONS])


class ClientTests(unittest.TestCase):
    def test_close_sends_reason(self):
        session = FakeSession(FakeResponse(200, {"id": "p"}))
        AdminApi("http://x", "tok", session=session).close_contribution_phase("p", "justFinished")
        call = session.calls[0]
        self.assertEqual(("POST", "http://x/api/Admin/Contribution/Phases/p/Close"), (call["method"], call["url"]))
        self.assertEqual({"reason": "justFinished"}, call["json"])

    def test_settings_put(self):
        session = FakeSession(FakeResponse(200, {"enabled": True}))
        AdminApi("http://x", "tok", session=session).set_contribution_settings(True, None, "p1")
        call = session.calls[0]
        self.assertEqual(("PUT", "http://x/api/Admin/Contribution/Settings"), (call["method"], call["url"]))
        self.assertEqual({"enabled": True, "reason": None, "activePhaseId": "p1"}, call["json"])

    def test_every_route(self):
        session = FakeSession(FakeResponse(200, {}))
        api = AdminApi("http://x", "tok", session=session)
        api.contribution_settings()
        api.contribution_phases(kind="vote", state="all")
        api.contribution_phase("p")
        api.contribution_texts("p", candidate_id="c", page=2)
        api.create_contribution_phase({"kind": "vote"})
        api.update_contribution_phase("p", {"kind": "vote"})
        api.interrupt_contribution_phase("p", "communityTooSmall")
        api.pick_contribution_winner("p", "c")
        api.delete_contribution_phase("p")
        self.assertEqual([
            ("GET", "http://x/api/Admin/Contribution/Settings", None),
            ("GET", "http://x/api/Admin/Contribution/Phases", {"kind": "vote"}),
            ("GET", "http://x/api/Admin/Contribution/Phases/p", None),
            ("GET", "http://x/api/Admin/Contribution/Phases/p/Texts", {"candidateId": "c", "page": 2}),
            ("POST", "http://x/api/Admin/Contribution/Phases", None),
            ("PUT", "http://x/api/Admin/Contribution/Phases/p", None),
            ("POST", "http://x/api/Admin/Contribution/Phases/p/Interrupt", None),
            ("POST", "http://x/api/Admin/Contribution/Phases/p/Winner", None),
            ("DELETE", "http://x/api/Admin/Contribution/Phases/p", None),
        ], [(c["method"], c["url"], c["params"]) for c in session.calls])
        self.assertEqual({"candidateId": "c"}, session.calls[7]["json"])


if __name__ == "__main__":
    unittest.main()
