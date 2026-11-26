"""The Contribution tab's Refresh (Tk, fake API).

Run from Coffer.Manager:  venv\\Scripts\\python.exe -m unittest contribution.test_view -v
"""
import copy
import tkinter as tk
import unittest

from contribution.view import ContributionView

PHOTO = {"id": "photo", "kind": "photo", "state": "open", "active": True, "endsAt": "2026-12-10T19:00:00Z",
         "openedAt": "2026-11-26T19:00:00Z", "subject": {"name": "Stamps"}, "folder": "/app/data/contributions/photo",
         "totals": {"detectionPhotos": 1, "forms": 0, "formPhotos": 0, "contributors": 1}}
VOTE = {"id": "vote", "kind": "vote", "state": "open", "active": False, "endsAt": "2026-12-10T19:00:00Z",
        "openedAt": "2026-11-26T19:00:00Z", "winnerCandidateId": None, "tie": False, "usedByPhotoPhases": 0,
        "candidates": [{"id": f"c{i}", "position": i + 1, "name": n, "votes": 0, "share": 0} for i, n in enumerate(("Coins", "Stamps", "Pins"))]}


class FakeApi:
    def __init__(self):
        self.phases = {"photo": copy.deepcopy(PHOTO), "vote": copy.deepcopy(VOTE)}
        self.phase_reads = []
        self.text_reads = 0

    def contribution_settings(self):
        return {"enabled": True, "reason": None, "activePhaseId": "photo"}

    def contribution_phases(self, **_):
        return [copy.deepcopy(p) for p in self.phases.values()]

    def contribution_phase(self, phase_id):
        self.phase_reads.append(phase_id)
        return copy.deepcopy(self.phases[phase_id])

    def contribution_texts(self, phase_id, candidate_id=None, page=1):
        self.text_reads += 1
        return {"items": [], "total": 0, "pageSize": 50}


class FakeSession:
    def __init__(self):
        self._api = FakeApi()

    def api(self):
        return self._api

    def handle(self, error):
        return False


class RefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tk = tk.Tk()
        cls.tk.withdraw()

    @classmethod
    def tearDownClass(cls):
        cls.tk.destroy()

    def setUp(self):
        self.session = FakeSession()
        self.view = ContributionView(self.tk, self.session)
        self.view.refresh()

    def tearDown(self):
        self.view.destroy()

    def _select(self, phase_id):
        self.view.tree.selection_set(phase_id)
        self.view._selected(None)

    def _labels(self):
        found = []

        def walk(widget):
            for child in widget.winfo_children():
                if isinstance(child, tk.Label):
                    found.append(child.cget("text"))
                walk(child)
        walk(self.view.detail)
        return found

    def test_refresh_requeries_the_selected_phase(self):
        self._select("photo")
        self.session.api().phases["photo"]["totals"] = {"detectionPhotos": 12, "forms": 3, "formPhotos": 18, "contributors": 4}

        self.view.refresh_button.invoke()

        self.assertEqual(["photo", "photo"], self.session.api().phase_reads)
        self.assertIn("12 detection photos · 3 classification forms (18 photos) · 4 contributors", self._labels())

    def test_refresh_reloads_a_votes_counts_and_texts(self):
        self._select("vote")
        self.session.api().phases["vote"]["candidates"][1].update(votes=5, share=1.0)

        self.view.refresh_button.invoke()

        self.assertEqual(5, self.view.phase["candidates"][1]["votes"])
        self.assertEqual(2, self.session.api().text_reads)

    def test_refresh_without_a_selection_reads_no_phase(self):
        self.view.refresh_button.invoke()

        self.assertEqual([], self.session.api().phase_reads)


if __name__ == "__main__":
    unittest.main()
