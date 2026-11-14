"""Admin views of Coffer.Manager: reported content (grouped), individual reports, suspended users.

Every call goes through Session.api() with the Manager token; the backend checks the administrator on each request.
"""
import io
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk
from tkinter.scrolledtext import ScrolledText

from reports.api import ApiError
from reports.formatting import content_row, format_content, format_report, format_suspension, short_row, suspension_row
from reports.resolution import DURATIONS, ResolutionPanel

STATUS_OPTIONS = ["open", "resolved", "all"]
TYPE_OPTIONS = ["all", "listing", "item", "comment", "message", "review"]


def _tree(parent, columns, widths, select="browse", height=None):
    frame = tk.Frame(parent)
    tree = ttk.Treeview(frame, columns=columns, show="headings", selectmode=select, height=height or 10)
    for col in columns:
        tree.heading(col, text=col.capitalize())
        tree.column(col, width=widths.get(col, 90), anchor="w")
    scroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=scroll.set)
    tree.pack(side="left", fill="both", expand=True)
    scroll.pack(side="left", fill="y")
    return frame, tree


def _text(widget, text):
    widget.configure(state="normal")
    widget.delete("1.0", "end")
    widget.insert("1.0", text)
    widget.configure(state="disabled")


class _AdminView(tk.Frame):
    def __init__(self, parent, session, title):
        super().__init__(parent)
        self.session = session
        self.info_var = tk.StringVar(value="")
        self._photo = None
        self.rules = []
        self.rule_labels = {}
        tk.Label(self, text=title, font=("Helvetica", 16, "bold"), fg="#2E86C1").pack(anchor="w", padx=10, pady=(5, 0))

    def call(self, fn, *args, **kwargs):
        """Runs an API call; shows errors, and returns to the sign-in screen when the session is gone."""
        try:
            return fn(*args, **kwargs)
        except ApiError as e:
            if self.session.handle(e):
                return None
            self.info_var.set(f"Error: {e}")
            messagebox.showerror("Coffer.Manager", str(e))
            return None

    def load_rules(self):
        if not self.rules:
            rules = self.call(self.session.api().rules)
            if rules:
                self.rules = rules
                self.rule_labels = {r["rule"]: r["label"] for r in rules}

    def show_image(self, label, thumbnail, size=(220, 160)):
        label.configure(image="", text="")
        self._photo = None
        if not thumbnail:
            return
        try:
            from PIL import Image, ImageTk
            data = self.session.api().image(thumbnail["kind"], thumbnail["fileName"])
            img = Image.open(io.BytesIO(data))
            img.thumbnail(size)
            self._photo = ImageTk.PhotoImage(img)
            label.configure(image=self._photo)
        except Exception as e:  # the picture is a nice-to-have
            label.configure(text=f"(image not available: {e.__class__.__name__})")


class ReportedContentView(_AdminView):
    """View B: one row per reported listing / item / comment / message / review, with all its reports."""

    def __init__(self, parent, session):
        super().__init__(parent, session, "Reported content")
        self.status_var = tk.StringVar(value="open")
        self.type_var = tk.StringVar(value="all")
        self.groups = {}
        self.detail = None
        self.report_rows = {}

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Label(bar, text="Status").pack(side="left")
        ttk.Combobox(bar, textvariable=self.status_var, values=STATUS_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Label(bar, text="Type").pack(side="left")
        ttk.Combobox(bar, textvariable=self.type_var, values=TYPE_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left", padx=10)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=820, height=640)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        columns = ("type", "content", "owner", "reports", "open", "reasons", "reporters", "statuses", "last")
        widths = {"type": 60, "content": 190, "owner": 70, "reports": 55, "open": 45, "reasons": 130, "reporters": 120, "statuses": 90, "last": 110}
        frame, self.tree = _tree(left, columns, widths, height=28)
        frame.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        right = tk.Frame(body)
        right.pack(side="left", fill="both", expand=True, padx=(10, 0))
        self.image_label = tk.Label(right)
        self.image_label.pack(anchor="w")
        self.text = ScrolledText(right, height=12, wrap="word", font=("Consolas", 9))
        self.text.pack(fill="both", expand=True)
        self.text.configure(state="disabled")

        tk.Label(right, text="Reports on this content (select several, or none = all open):").pack(anchor="w")
        frame2, self.reports_tree = _tree(right, ("reporter", "rule", "status", "reason"),
                                          {"reporter": 80, "rule": 120, "status": 80, "reason": 300}, select="extended", height=4)
        frame2.pack(fill="x")
        self.reports_tree.bind("<<TreeviewSelect>>", lambda _e: self._update_affected())

        self.panel = ResolutionPanel(right, self._resolve, self._count_text)
        self.panel.pack(fill="x", pady=4)

    def refresh(self):
        self.load_rules()
        page = self.call(self.session.api().list_content, self.status_var.get(), self.type_var.get())
        if page is None:
            return
        self.tree.delete(*self.tree.get_children())
        self.groups = {}
        for g in page["items"]:
            iid = self.tree.insert("", "end", values=content_row(g, self.rule_labels))
            self.groups[iid] = g
        self.info_var.set(f"{page['total']} reported piece(s) of content.")
        self._show(None)

    def _on_select(self, _event=None):
        sel = self.tree.selection()
        if not sel:
            return
        g = self.groups[sel[0]]
        self._show(self.call(self.session.api().get_content, g["targetType"], g["targetId"]))

    def _show(self, detail):
        self.detail = detail
        self.reports_tree.delete(*self.reports_tree.get_children())
        self.report_rows = {}
        if not detail:
            _text(self.text, "")
            self.image_label.configure(image="", text="")
            self.panel.set_enabled(False)
            self.panel.set_affected("")
            return
        _text(self.text, format_content(detail, self.rule_labels))
        for r in detail["reports"]:
            iid = self.reports_tree.insert("", "end", values=(
                (r.get("reporter") or {}).get("name"), self.rule_labels.get(r["rule"], r["rule"]),
                r["status"] if r["status"] == "open" else r.get("decision"), r.get("reason")))
            self.report_rows[iid] = r
        content = detail["content"]
        self.panel.set_rules(self.rules, [content["targetType"]])
        self.panel.clear()
        self.panel.set_enabled(content["openCount"] > 0)
        self._update_affected()
        self.show_image(self.image_label, content.get("thumbnail"))

    def _selected_open_ids(self):
        return [self.report_rows[i]["id"] for i in self.reports_tree.selection() if self.report_rows[i]["status"] == "open"]

    def _update_affected(self):
        if not self.detail:
            return
        selected = self._selected_open_ids()
        n = len(selected) if selected else self.detail["content"]["openCount"]
        self.panel.set_affected(f"Affects {n} open report(s)" + ("" if selected else " (all open on this content)"))

    def _count_text(self):
        selected = self._selected_open_ids()
        if selected:
            return f"This resolves the {len(selected)} selected report(s) (removal also answers the other open reports on this content)."
        return f"This resolves all {self.detail['content']['openCount']} open report(s) on this content."

    def _resolve(self, decision, rule, statement, hours):
        content = self.detail["content"]
        selected = self._selected_open_ids()
        api = self.session.api()
        if selected:
            result = self.call(api.resolve_many, selected, decision, rule, statement, hours)
        else:
            result = self.call(api.resolve_content, content["targetType"], content["targetId"], decision, rule, statement, hours)
        if result is None:
            return
        notes = "\n".join(result.get("notes") or [])
        suspended = ", ".join(f"{s['userName']} until {s['endsAt'][:16].replace('T', ' ')}" for s in result.get("suspensions") or [])
        messagebox.showinfo("Resolved", f"{result['resolvedCount']} report(s) resolved."
                            + (f"\nSuspended: {suspended}" if suspended else "") + (f"\n{notes}" if notes else ""))
        self.refresh()


class ReportsView(_AdminView):
    """View A: individual reports. Select several (Ctrl/Shift) to resolve them together with one explanation."""

    def __init__(self, parent, session):
        super().__init__(parent, session, "Individual reports")
        self.status_var = tk.StringVar(value="open")
        self.type_var = tk.StringVar(value="all")
        self.reports = {}

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Label(bar, text="Status").pack(side="left")
        ttk.Combobox(bar, textvariable=self.status_var, values=STATUS_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Label(bar, text="Type").pack(side="left")
        ttk.Combobox(bar, textvariable=self.type_var, values=TYPE_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left", padx=10)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=760, height=640)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        columns = ("created", "type", "rule", "target", "reporter", "owner", "status")
        widths = {"created": 110, "type": 65, "rule": 140, "target": 210, "reporter": 80, "owner": 80, "status": 70}
        frame, self.tree = _tree(left, columns, widths, select="extended", height=28)
        frame.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        right = tk.Frame(body)
        right.pack(side="left", fill="both", expand=True, padx=(10, 0))
        self.image_label = tk.Label(right)
        self.image_label.pack(anchor="w")
        self.detail = ScrolledText(right, height=16, wrap="word", font=("Consolas", 9))
        self.detail.pack(fill="both", expand=True)
        self.detail.configure(state="disabled")
        self.panel = ResolutionPanel(right, self._resolve, self._count_text)
        self.panel.pack(fill="x", pady=4)

    def refresh(self):
        self.load_rules()
        page = self.call(self.session.api().list_reports, self.status_var.get(), self.type_var.get())
        if page is None:
            return
        self.tree.delete(*self.tree.get_children())
        self.reports = {}
        for report in page["items"]:
            iid = self.tree.insert("", "end", values=short_row(report, self.rule_labels))
            self.reports[iid] = report
        self.info_var.set(f"{page['total']} report(s). Ctrl/Shift-click to select several.")
        self._on_select()

    def _selected(self):
        return [self.reports[i] for i in self.tree.selection()]

    def _on_select(self, _event=None):
        selected = self._selected()
        open_ones = [r for r in selected if r["status"] == "open"]
        self.panel.set_enabled(bool(open_ones))
        self.panel.set_rules(self.rules, sorted({r["targetType"] for r in open_ones}))
        self.panel.set_affected(f"{len(open_ones)} open report(s) selected" if open_ones else "")
        self.image_label.configure(image="", text="")
        if len(selected) == 1:
            detail = self.call(self.session.api().get_report, selected[0]["id"])
            if detail:
                _text(self.detail, format_report(detail, self.rule_labels))
                self.show_image(self.image_label, detail.get("thumbnail"))
        elif selected:
            _text(self.detail, f"{len(selected)} reports selected ({len(open_ones)} open).\n\n" + "\n".join(
                f"• {r['targetType']} · {self.rule_labels.get(r['rule'], r['rule'])} · {r.get('targetSummary')}" for r in selected))
        else:
            _text(self.detail, "")

    def _count_text(self):
        n = len([r for r in self._selected() if r["status"] == "open"])
        return f"This resolves {n} report(s) with the same explanation (a removal also answers other open reports on the same content)."

    def _resolve(self, decision, rule, statement, hours):
        ids = [r["id"] for r in self._selected() if r["status"] == "open"]
        result = self.call(self.session.api().resolve_many, ids, decision, rule, statement, hours)
        if result is None:
            return
        notes = "\n".join(result.get("notes") or [])
        messagebox.showinfo("Resolved", f"{result['resolvedCount']} report(s) resolved." + (f"\n{notes}" if notes else ""))
        self.panel.clear()
        self.refresh()


class SuspensionsView(_AdminView):
    """Suspended users: active and past suspensions, revoke, suspend a user by hand, per-user history."""

    def __init__(self, parent, session):
        super().__init__(parent, session, "Suspended users")
        self.status_var = tk.StringVar(value="active")
        self.query_var = tk.StringVar()
        self.duration_var = tk.StringVar(value=DURATIONS[2][0])
        self.rows = {}
        self.users = {}

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Label(bar, text="Show").pack(side="left")
        ttk.Combobox(bar, textvariable=self.status_var, values=["active", "expired", "revoked", "all"], width=9, state="readonly").pack(side="left", padx=5)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left", padx=10)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=820, height=640)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        columns = ("created", "user", "status", "starts", "ends", "by", "reason")
        widths = {"created": 110, "user": 90, "status": 70, "starts": 110, "ends": 110, "by": 100, "reason": 220}
        frame, self.tree = _tree(left, columns, widths, height=28)
        frame.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        right = tk.Frame(body)
        right.pack(side="left", fill="both", expand=True, padx=(10, 0))
        self.text = ScrolledText(right, height=10, wrap="word", font=("Consolas", 9))
        self.text.pack(fill="x")
        self.text.configure(state="disabled")
        buttons = tk.Frame(right)
        buttons.pack(fill="x", pady=4)
        self.revoke_button = tk.Button(buttons, text="Revoke suspension", command=self._revoke, state="disabled")
        self.revoke_button.pack(side="left")
        self.history_button = tk.Button(buttons, text="User's suspension history", command=self._history, state="disabled")
        self.history_button.pack(side="left", padx=10)

        box = tk.LabelFrame(right, text="Suspend a user")
        box.pack(fill="x", pady=8)
        row = tk.Frame(box)
        row.pack(fill="x", padx=5, pady=3)
        tk.Label(row, text="User name").pack(side="left")
        tk.Entry(row, textvariable=self.query_var, width=20).pack(side="left", padx=5)
        tk.Button(row, text="Search", command=self._search).pack(side="left")
        self.user_list = tk.Listbox(box, height=5)
        self.user_list.pack(fill="x", padx=5)
        row2 = tk.Frame(box)
        row2.pack(fill="x", padx=5, pady=3)
        tk.Label(row2, text="Duration").pack(side="left")
        ttk.Combobox(row2, textvariable=self.duration_var, values=[d[0] for d in DURATIONS], width=9, state="readonly").pack(side="left", padx=5)
        tk.Label(box, text="Reason (shown to the user):").pack(anchor="w", padx=5)
        self.reason = tk.Text(box, height=3, wrap="word")
        self.reason.pack(fill="x", padx=5)
        tk.Button(box, text="Suspend", bg="#C0392B", fg="white", command=self._suspend).pack(anchor="w", padx=5, pady=5)

    def refresh(self):
        page = self.call(self.session.api().suspensions, self.status_var.get())
        if page is None:
            return
        self.tree.delete(*self.tree.get_children())
        self.rows = {}
        for s in page["items"]:
            iid = self.tree.insert("", "end", values=suspension_row(s))
            self.rows[iid] = s
        self.info_var.set(f"{page['total']} suspension(s).")
        self._on_select()

    def _selected(self):
        sel = self.tree.selection()
        return self.rows.get(sel[0]) if sel else None

    def _on_select(self, _event=None):
        s = self._selected()
        _text(self.text, format_suspension(s) if s else "")
        self.revoke_button.configure(state="normal" if s and s["status"] == "active" else "disabled")
        self.history_button.configure(state="normal" if s else "disabled")

    def _revoke(self):
        s = self._selected()
        reason = simpledialog.askstring("Revoke suspension", f"Why is the suspension of {s['user']['name']} revoked?", parent=self)
        if not reason:
            return
        if self.call(self.session.api().revoke, s["id"], reason) is not None:
            self.refresh()

    def _history(self):
        s = self._selected()
        page = self.call(self.session.api().user_suspensions, s["user"]["id"])
        if page is not None:
            _text(self.text, f"HISTORY OF {s['user']['name']} ({page['total']})\n\n" + "\n\n".join(format_suspension(x) for x in page["items"]))

    def _search(self):
        page = self.call(self.session.api().search_users, self.query_var.get().strip())
        if page is None:
            return
        self.user_list.delete(0, "end")
        self.users = {}
        for i, u in enumerate(page["items"]):
            suspended = f"  [suspended until {u['activeSuspension']['endsAt'][:16].replace('T', ' ')}]" if u.get("activeSuspension") else ""
            self.user_list.insert("end", f"{u['name']} · {u['provider']} · removals: {u['removalCount']}{suspended}")
            self.users[i] = u

    def _suspend(self):
        sel = self.user_list.curselection()
        if not sel:
            messagebox.showwarning("Suspend", "Search and select a user first.")
            return
        user = self.users[sel[0]]
        reason = self.reason.get("1.0", "end").strip()
        if len(reason) < 10:
            messagebox.showwarning("Suspend", "Write the reason (at least 10 characters). The user sees it.")
            return
        hours = dict(DURATIONS)[self.duration_var.get()]
        if not messagebox.askyesno("Suspend", f"Suspend {user['name']} for {self.duration_var.get()}?\nThey can't use Coffer until it ends."):
            return
        if self.call(self.session.api().suspend, user["id"], hours, reason) is not None:
            self.reason.delete("1.0", "end")
            self._search()
            self.refresh()
