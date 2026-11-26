"""The Contribution tab: runs Shape What's Next — the switch, voting phases, photo phases, results and free texts."""
import tkinter as tk
from datetime import datetime, timedelta, timezone
from tkinter import messagebox, ttk

from contribution.logic import (REASONS, format_local, most_recent_source_id, parse_local, phase_label, phone_preview,
                                state_label, winner_sources)
from itemtypes.translations import placeholder
from itemtypes.view import GREY, RED, JsonBox
from reports.view import _AdminView, _tree

BAR = "#2E86C1"
WINNER = "#1E8449"
KINDS = ["all", "vote", "photo"]
STATES = ["all", "draft", "open", "closed", "interrupted"]


class ReasonDialog(tk.Toplevel):
    """Asks why there is no contribution period (when a running phase is interrupted)."""

    def __init__(self, parent, title, message):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.transient(parent)
        self.result = None
        tk.Label(self, text=message, justify="left", wraplength=380).pack(anchor="w", padx=12, pady=(12, 6))
        self.reason = ttk.Combobox(self, state="readonly", width=40, values=[label for _, label in REASONS])
        self.reason.current(1)
        self.reason.pack(anchor="w", padx=12)
        buttons = tk.Frame(self)
        buttons.pack(fill="x", padx=12, pady=12)
        tk.Button(buttons, text="Cancel", command=self.destroy).pack(side="right")
        tk.Button(buttons, text="OK", command=self._ok).pack(side="right", padx=6)

    def _ok(self):
        self.result = REASONS[self.reason.current()][0]
        self.destroy()

    def run(self):
        self.grab_set()
        self.wait_window()
        return self.result


class CandidateRow(tk.LabelFrame):
    """One candidate of a voting draft: name, description and their Hungarian (JSON) boxes."""

    def __init__(self, parent, position):
        super().__init__(parent, text=f"Candidate {position}")
        top = tk.Frame(self)
        top.pack(fill="x")
        tk.Label(top, text="Name").pack(side="left")
        self.name = tk.Entry(top, width=24)
        self.name.pack(side="left", padx=(4, 12))
        tk.Label(top, text="Description").pack(side="left")
        self.description = tk.Entry(top, width=60)
        self.description.pack(side="left", padx=4, fill="x", expand=True)
        boxes = tk.Frame(self)
        boxes.pack(fill="x")
        self.name_tr = JsonBox(boxes, "Name translations (JSON)", height=2)
        self.name_tr.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.description_tr = JsonBox(boxes, "Description translations (JSON)", height=2)
        self.description_tr.pack(side="left", fill="x", expand=True)

    def show(self, candidate):
        candidate = candidate or {}
        self.name.delete(0, "end")
        self.name.insert(0, candidate.get("name", ""))
        self.description.delete(0, "end")
        self.description.insert(0, candidate.get("description", ""))
        self.name_tr.show(candidate.get("nameTranslations"), placeholder("name"))
        self.description_tr.show(candidate.get("descriptionTranslations"), placeholder("description"))

    def value(self):
        name_tr, description_tr = self.name_tr.value(), self.description_tr.value()
        if name_tr is None or description_tr is None:
            return None
        return {"name": self.name.get().strip(), "nameTranslations": name_tr,
                "description": self.description.get().strip(), "descriptionTranslations": description_tr}

    def raw(self):
        return (self.name.get(), self.description.get(), self.name_tr.text.get("1.0", "end"), self.description_tr.text.get("1.0", "end"))


class ContributionView(_AdminView):
    def __init__(self, parent, session):
        super().__init__(parent, session, "Shape What's Next (contribution)")
        self.settings = {}
        self.phases = []
        self.phase = None          # the phase shown in the detail panel (None while creating)
        self.new_kind = None       # "vote" / "photo" while creating
        self.texts_page = 1
        self._snapshot = None

        self._build_switch()
        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self._build_list(body)
        self.detail = tk.LabelFrame(body, text="Phase")
        self.detail.pack(side="left", fill="both", expand=True, padx=(10, 0))
        tk.Label(self, textvariable=self.info_var, fg="gray", anchor="w").pack(fill="x", padx=10)

    # ------------------------------------------------------------------ switch

    def _build_switch(self):
        box = tk.LabelFrame(self, text="Switch")
        box.pack(fill="x", padx=10, pady=6)
        row = tk.Frame(box)
        row.pack(fill="x", padx=6, pady=4)
        self.enabled_var = tk.BooleanVar(value=False)
        tk.Radiobutton(row, text="On", variable=self.enabled_var, value=True, command=self._switch_changed).pack(side="left")
        tk.Radiobutton(row, text="Off", variable=self.enabled_var, value=False, command=self._switch_changed).pack(side="left", padx=(0, 16))
        tk.Label(row, text="Active phase").pack(side="left")
        self.active_box = ttk.Combobox(row, state="readonly", width=60)
        self.active_box.pack(side="left", padx=(4, 16))
        self.reason_label = tk.Label(row, text="Reason")
        self.reason_label.pack(side="left")
        self.reason_box = ttk.Combobox(row, state="readonly", width=32, values=[label for _, label in REASONS])
        self.reason_box.pack(side="left", padx=4)
        tk.Button(row, text="Save switch", command=self._save_switch).pack(side="right")
        tk.Button(row, text="Refresh", command=self.refresh).pack(side="right", padx=6)
        self.preview = tk.Label(box, text="", fg=GREY, anchor="w")
        self.preview.pack(fill="x", padx=6, pady=(0, 4))
        self._active_choices = []

    def _switch_changed(self):
        on = self.enabled_var.get()
        self.active_box.configure(state="readonly" if on else "disabled")
        self.reason_box.configure(state="disabled" if on else "readonly")

    def _show_switch(self):
        s = self.settings
        self.enabled_var.set(bool(s.get("enabled")))
        self._active_choices = [p for p in self.phases if p["state"] in ("draft", "open")]
        self.active_box.configure(values=[f"{phase_label(p)} — {state_label(p)}" for p in self._active_choices])
        ids = [p["id"] for p in self._active_choices]
        if s.get("activePhaseId") in ids:
            self.active_box.current(ids.index(s["activePhaseId"]))
        else:
            self.active_box.set("")
        keys = [k for k, _ in REASONS]
        self.reason_box.current(keys.index(s["reason"]) if s.get("reason") in keys else 1)
        self._switch_changed()
        active = next((p for p in self.phases if p["id"] == s.get("activePhaseId")), None)
        self.preview.configure(text="Phone shows: " + phone_preview(s, active if s.get("enabled") else None, datetime.now(timezone.utc)))

    def _save_switch(self):
        if self.enabled_var.get():
            index = self.active_box.current()
            if index < 0:
                messagebox.showerror("Coffer.Manager", "Choose the phase to run (a draft opens now).", parent=self)
                return
            result = self.call(self.session.api().set_contribution_settings, True, None, self._active_choices[index]["id"])
        else:
            result = self.call(self.session.api().set_contribution_settings, False, REASONS[self.reason_box.current()][0], None)
        if result is not None:
            self.info_var.set("Switch saved.")
            self.refresh(keep=self.phase["id"] if self.phase else None)
            if self.phase:
                self._reload()  # a draft may have opened

    # ------------------------------------------------------------------ list

    def _build_list(self, body):
        box = tk.LabelFrame(body, text="Phases")
        box.pack(side="left", fill="y")
        filters = tk.Frame(box)
        filters.pack(fill="x", padx=6, pady=4)
        self.kind_filter = ttk.Combobox(filters, state="readonly", width=8, values=KINDS)
        self.kind_filter.current(0)
        self.kind_filter.pack(side="left")
        self.state_filter = ttk.Combobox(filters, state="readonly", width=12, values=STATES)
        self.state_filter.current(0)
        self.state_filter.pack(side="left", padx=6)
        for box_ in (self.kind_filter, self.state_filter):
            box_.bind("<<ComboboxSelected>>", lambda _e: self._fill_list())
        frame, self.tree = _tree(box, ("kind", "phase", "state", "ends", "totals"),
                                 {"kind": 50, "phase": 260, "state": 100, "ends": 120, "totals": 110}, height=22)
        frame.pack(fill="both", expand=True, padx=6)
        self.tree.bind("<<TreeviewSelect>>", self._selected)
        buttons = tk.Frame(box)
        buttons.pack(fill="x", padx=6, pady=6)
        tk.Button(buttons, text="New voting phase", command=lambda: self._new("vote")).pack(side="left")
        tk.Button(buttons, text="New photo phase", command=lambda: self._new("photo")).pack(side="left", padx=6)
        tk.Label(box, text="★ most recent closed vote with a winner", fg=GREY).pack(anchor="w", padx=6, pady=(0, 6))

    def refresh(self, keep=None):
        settings = self.call(self.session.api().contribution_settings)
        phases = self.call(self.session.api().contribution_phases)
        if settings is None or phases is None:
            return
        self.settings, self.phases = settings, phases
        self._show_switch()
        self._fill_list()
        keep = keep or (self.phase["id"] if self.phase else None)
        if keep and any(p["id"] == keep for p in self.phases):
            self.tree.selection_set(keep)
            self.tree.see(keep)
        elif self.new_kind is None:
            self._clear_detail("Select a phase, or create one.")

    def _fill_list(self):
        self.tree.delete(*self.tree.get_children())
        star = most_recent_source_id(self.phases)
        kind, state = self.kind_filter.get(), self.state_filter.get()
        for p in self.phases:
            if kind != "all" and p["kind"] != kind or state != "all" and p["state"] != state:
                continue
            label = phase_label(p) + (" ★" if p["id"] == star else "")
            if p["kind"] == "vote" and p.get("usedByPhotoPhases"):
                label += f" · used by {p['usedByPhotoPhases']}"
            self.tree.insert("", "end", iid=p["id"], values=(p["kind"], label, state_label(p), format_local(p.get("endsAt")), self._totals(p)))

    @staticmethod
    def _totals(p):
        if p["kind"] == "vote":
            return f"{sum(c.get('votes', 0) for c in p.get('candidates', []))} votes"
        t = p.get("totals") or {}
        return f"{t.get('detectionPhotos', 0)} photos · {t.get('forms', 0)} forms"

    def _selected(self, _event):
        selection = self.tree.selection()
        if not selection or (self.phase and self.phase["id"] == selection[0]):
            return
        if not self.can_leave():
            if self.phase:
                self.tree.selection_set(self.phase["id"])
            return
        phase = self.call(self.session.api().contribution_phase, selection[0])
        if phase is not None:
            self.new_kind = None
            self._show(phase)

    def _new(self, kind):
        if not self.can_leave():
            return
        self.tree.selection_remove(self.tree.selection())
        self.phase, self.new_kind = None, kind
        self._show(None)

    # ------------------------------------------------------------------ detail

    def _clear_detail(self, message=""):
        for child in self.detail.winfo_children():
            child.destroy()
        self.phase, self._snapshot = None, None
        if message:
            tk.Label(self.detail, text=message, fg=GREY).pack(anchor="w", padx=8, pady=8)

    def _show(self, phase):
        for child in self.detail.winfo_children():
            child.destroy()
        self.phase = phase
        kind = phase["kind"] if phase else self.new_kind
        state = phase["state"] if phase else "draft"
        self.detail.configure(text=(f"{phase_label(phase)} — {state_label(phase)}" if phase else f"New {'voting' if kind == 'vote' else 'photo'} phase (draft)"))
        f = tk.Frame(self.detail)
        f.pack(fill="both", expand=True, padx=8, pady=6)

        self.ends_entry = None
        if state in ("draft", "open"):
            self._end_date_row(f, phase)
        else:
            tk.Label(f, text=f"Closed {format_local(phase.get('closedAt'))}  ·  opened {format_local(phase.get('openedAt'))}", fg=GREY).pack(anchor="w")

        self.rows = []
        self.source_choices = []
        if kind == "vote" and state == "draft":
            for i in range(3):
                row = CandidateRow(f, i + 1)
                row.pack(fill="x", pady=3)
                row.show((phase or {}).get("candidates", [None] * 3)[i] if phase else None)
                self.rows.append(row)
        elif kind == "vote":
            self._results(f, phase)
        elif state == "draft":
            self._source_picker(f, phase)
        else:
            self._photo_summary(f, phase)

        self._actions(f, phase, state)
        self._snapshot = self._raw()

    def _end_date_row(self, f, phase):
        row = tk.Frame(f)
        row.pack(anchor="w", pady=(0, 6))
        tk.Label(row, text="Ends (local time, YYYY-MM-DD HH:MM)").pack(side="left")
        self.ends_entry = tk.Entry(row, width=18)
        self.ends_entry.pack(side="left", padx=4)
        ends = format_local((phase or {}).get("endsAt"))
        self.ends_entry.insert(0, ends or (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d 20:00"))
        tk.Button(row, text="+1 day", command=lambda: self._shift_end(1)).pack(side="left", padx=2)
        tk.Button(row, text="+7 days", command=lambda: self._shift_end(7)).pack(side="left", padx=2)
        if phase and phase.get("openedAt"):
            tk.Label(row, text=f"opened {format_local(phase['openedAt'])}", fg=GREY).pack(side="left", padx=10)

    def _shift_end(self, days):
        try:
            current = parse_local(self.ends_entry.get()).astimezone()
        except ValueError:
            current = datetime.now().astimezone()
        self.ends_entry.delete(0, "end")
        self.ends_entry.insert(0, (current + timedelta(days=days)).strftime("%Y-%m-%d %H:%M"))

    def _results(self, f, phase):
        candidates = sorted(phase.get("candidates", []), key=lambda c: c.get("position", 0))
        canvas = tk.Canvas(f, height=34 * len(candidates) + 6, width=760, highlightthickness=0)
        canvas.pack(anchor="w", pady=4)
        for i, c in enumerate(candidates):
            y = 6 + i * 34
            won = c["id"] == phase.get("winnerCandidateId")
            canvas.create_text(4, y + 12, anchor="w", text=("★ " if won else "") + c["name"], font=("Helvetica", 10, "bold" if won else "normal"))
            canvas.create_rectangle(200, y + 2, 200 + 400, y + 22, outline="#D0D0D0")
            canvas.create_rectangle(200, y + 2, 200 + int(400 * c.get("share", 0)), y + 22, fill=WINNER if won else BAR, width=0)
            canvas.create_text(612, y + 12, anchor="w", text=f"{round(c.get('share', 0) * 100)} %   {c.get('votes', 0)} votes")
        if phase.get("tie") or (phase["state"] == "closed" and not phase.get("winnerCandidateId")):
            banner = tk.Frame(f)
            banner.pack(anchor="w", pady=4)
            top = max((c.get("votes", 0) for c in candidates), default=0)
            choices = [c for c in candidates if top == 0 or c.get("votes", 0) == top]
            tk.Label(banner, text="Tie — pick the winner:" if phase.get("tie") else "No votes — pick the winner:", fg=RED).pack(side="left")
            self.winner_box = ttk.Combobox(banner, state="readonly", width=30, values=[c["name"] for c in choices])
            self.winner_box.pack(side="left", padx=6)
            tk.Button(banner, text="Pick winner", command=lambda: self._pick_winner(choices)).pack(side="left")
        if phase.get("usedByPhotoPhases"):
            tk.Label(f, text=f"Used by {phase['usedByPhotoPhases']} photo phase(s).", fg=GREY).pack(anchor="w")

        texts = tk.LabelFrame(f, text="What voters wrote")
        texts.pack(fill="both", expand=True, pady=6)
        bar = tk.Frame(texts)
        bar.pack(fill="x", padx=6, pady=4)
        self.text_filter = ttk.Combobox(bar, state="readonly", width=30, values=["All candidates"] + [c["name"] for c in candidates])
        self.text_filter.current(0)
        self.text_filter.pack(side="left")
        self.text_filter.bind("<<ComboboxSelected>>", lambda _e: self._load_texts(1))
        tk.Button(bar, text="◀", command=lambda: self._load_texts(self.texts_page - 1)).pack(side="left", padx=(12, 2))
        self.texts_info = tk.Label(bar, text="", fg=GREY)
        self.texts_info.pack(side="left")
        tk.Button(bar, text="▶", command=lambda: self._load_texts(self.texts_page + 1)).pack(side="left", padx=2)
        self.texts = tk.Text(texts, height=12, wrap="word", state="disabled")
        self.texts.pack(fill="both", expand=True, padx=6, pady=(0, 6))
        self._candidates = candidates
        self._load_texts(1)

    def _load_texts(self, page):
        if page < 1:
            return
        index = self.text_filter.current()
        candidate_id = self._candidates[index - 1]["id"] if index > 0 else None
        result = self.call(self.session.api().contribution_texts, self.phase["id"], candidate_id, page)
        if result is None:
            return
        pages = max(1, -(-result.get("total", 0) // max(1, result.get("pageSize", 50))))
        if page > pages and page > 1:
            return
        self.texts_page = page
        names = {c["id"]: c["name"] for c in self._candidates}
        self.texts.configure(state="normal")
        self.texts.delete("1.0", "end")
        for t in result.get("items", []):
            self.texts.insert("end", f"{names.get(t['candidateId'], '?')} · {format_local(t.get('updatedAt'))}\n", "head")
            self.texts.insert("end", t["text"] + "\n\n")
        self.texts.tag_configure("head", foreground=BAR)
        self.texts.configure(state="disabled")
        self.texts_info.configure(text=f"page {page} of {pages} · {result.get('total', 0)} texts")

    def _source_picker(self, f, phase):
        row = tk.Frame(f)
        row.pack(anchor="w", pady=4)
        tk.Label(row, text="Photos for the winner of").pack(side="left")
        self.source_choices = winner_sources(self.phases)
        recent = most_recent_source_id(self.phases)
        labels = []
        for p in self.source_choices:
            winner = next((c["name"] for c in p.get("candidates", []) if c["id"] == p.get("winnerCandidateId")), "?")
            label = f"{winner} — {phase_label(p)}, closed {format_local(p.get('closedAt'))}"
            if p["id"] == recent:
                label += "  (most recent)"
            if p.get("usedByPhotoPhases"):
                label += f"  · used by {p['usedByPhotoPhases']}"
            labels.append(label)
        self.source_box = ttk.Combobox(row, state="readonly", width=90, values=labels)
        self.source_box.pack(side="left", padx=6)
        ids = [p["id"] for p in self.source_choices]
        chosen = (phase or {}).get("sourcePhaseId") or recent
        if chosen in ids:
            self.source_box.current(ids.index(chosen))
        if not ids:
            tk.Label(f, text="No closed voting phase with a winner yet.", fg=RED).pack(anchor="w")

    def _photo_summary(self, f, phase):
        subject = phase.get("subject") or {}
        tk.Label(f, text=f"Subject: {subject.get('name', '(none)')}", font=("Helvetica", 11, "bold")).pack(anchor="w", pady=(4, 2))
        t = phase.get("totals") or {}
        tk.Label(f, text=f"{t.get('detectionPhotos', 0)} detection photos · {t.get('forms', 0)} classification forms "
                         f"({t.get('formPhotos', 0)} photos) · {t.get('contributors', 0)} contributors").pack(anchor="w")
        row = tk.Frame(f)
        row.pack(anchor="w", pady=6)
        tk.Label(row, text="Folder:").pack(side="left")
        folder = tk.Entry(row, width=90)
        folder.insert(0, phase.get("folder") or "")
        folder.configure(state="readonly")
        folder.pack(side="left", padx=4)
        tk.Button(row, text="Copy", command=lambda: (self.clipboard_clear(), self.clipboard_append(phase.get("folder") or ""))).pack(side="left")

    def _actions(self, f, phase, state):
        row = tk.Frame(f)
        row.pack(fill="x", pady=8, side="bottom")
        if state == "draft":
            tk.Button(row, text="Save draft", command=self._save).pack(side="left")
            if phase:
                tk.Button(row, text="Delete", fg=RED, command=self._delete).pack(side="right")
        elif state == "open":
            tk.Button(row, text="Save end date", command=self._save).pack(side="left")
            tk.Button(row, text="Close now", command=self._close).pack(side="left", padx=6)
            tk.Button(row, text="Interrupt…", fg=RED, command=self._interrupt).pack(side="right")

    # ------------------------------------------------------------------ actions

    def _ends_iso(self):
        try:
            return parse_local(self.ends_entry.get()).isoformat()
        except ValueError as e:
            messagebox.showerror("Coffer.Manager", str(e), parent=self)
            return None

    def _save(self):
        ends = self._ends_iso()
        if ends is None:
            return False
        kind = self.phase["kind"] if self.phase else self.new_kind
        body = {"kind": kind, "endsAt": ends}
        if (not self.phase or self.phase["state"] == "draft") and kind == "vote":
            candidates = [row.value() for row in self.rows]
            if any(c is None for c in candidates):
                return False
            body["candidates"] = candidates
        if (not self.phase or self.phase["state"] == "draft") and kind == "photo":
            index = self.source_box.current()
            if index < 0:
                messagebox.showerror("Coffer.Manager", "Choose the closed voting phase whose winner gets photos.", parent=self)
                return False
            body["sourcePhaseId"] = self.source_choices[index]["id"]
        api = self.session.api()
        saved = self.call(api.update_contribution_phase, self.phase["id"], body) if self.phase else self.call(api.create_contribution_phase, body)
        if saved is None:
            return False
        self.new_kind = None
        self.info_var.set("Saved.")
        self.phase = saved
        self.refresh(keep=saved["id"])
        self._show(saved)
        return True

    def _close(self):
        if not messagebox.askyesno("Coffer.Manager", "Close this phase now? A voting phase gets its winner; the switch turns off "
                                                     "with \"one just finished\" if this phase is running.", parent=self):
            return
        if self.call(self.session.api().close_contribution_phase, self.phase["id"], None) is not None:
            self.refresh(keep=self.phase["id"])
            self._reload()

    def _interrupt(self):
        running = self.settings.get("enabled") and self.settings.get("activePhaseId") == self.phase["id"]
        if running:
            reason = ReasonDialog(self, "Interrupt", "Interrupt this phase? It ends without a winner (photos already uploaded "
                                                     "stay). The phone will say there is no contribution period, because:").run()
            if reason is None:
                return
        else:
            if not messagebox.askyesno("Coffer.Manager", "Interrupt this paused phase? It ends without a winner.", parent=self):
                return
            reason = None
        if self.call(self.session.api().interrupt_contribution_phase, self.phase["id"], reason) is not None:
            self.refresh(keep=self.phase["id"])
            self._reload()

    def _pick_winner(self, choices):
        index = self.winner_box.current()
        if index < 0:
            return
        if not messagebox.askyesno("Coffer.Manager", f"Make {choices[index]['name']} the winner? This can't be changed later.", parent=self):
            return
        if self.call(self.session.api().pick_contribution_winner, self.phase["id"], choices[index]["id"]) is not None:
            self.refresh(keep=self.phase["id"])
            self._reload()

    def _delete(self):
        if not messagebox.askyesno("Coffer.Manager", "Delete this draft?", parent=self):
            return
        phase_id = self.phase["id"]
        # call() answers None on errors; the delete itself answers nothing, so success is marked explicitly.
        if self.call(lambda: self.session.api().delete_contribution_phase(phase_id) or True):
            self._clear_detail("Draft deleted.")
            self.refresh()

    def _reload(self):
        phase = self.call(self.session.api().contribution_phase, self.phase["id"])
        if phase is not None:
            self._show(phase)

    # ------------------------------------------------------------------ unsaved changes

    def _raw(self):
        if not self.detail.winfo_children():
            return None
        ends = self.ends_entry.get() if self.ends_entry else None
        rows = tuple(row.raw() for row in self.rows)
        source = self.source_box.get() if self.source_choices else None
        return ends, rows, source

    def can_leave(self):
        """Asked before another phase or another tab is shown: save, discard or stay."""
        if self._snapshot is None or self._raw() == self._snapshot:
            return True
        answer = messagebox.askyesnocancel("Coffer.Manager", "This phase has unsaved changes. Save them?", parent=self)
        if answer is None:
            return False
        return self._save() if answer else True
