"""Admin "Reports" view: list user reports, inspect the frozen evidence, remove content or dismiss.

Connection: API URL + an admin JWT. Defaults come from the environment (COFFER_API_URL, COFFER_ADMIN_TOKEN,
also read from a .env file next to app.py); both can be typed in. Only Admin accounts get data (others: 403).
"""
import io
import os
import tkinter as tk
from tkinter import messagebox, ttk
from tkinter.scrolledtext import ScrolledText

from dotenv import load_dotenv

from reports.api import AdminApi, ApiError
from reports.formatting import format_report, short_row

load_dotenv()

STATUS_OPTIONS = ["open", "resolved", "all"]
TYPE_OPTIONS = ["all", "listing", "message", "review"]


class ReportsView(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.api_url_var = tk.StringVar(value=os.getenv("COFFER_API_URL", "http://localhost:5141"))
        self.token_var = tk.StringVar(value=os.getenv("COFFER_ADMIN_TOKEN", ""))
        self.status_var = tk.StringVar(value="open")
        self.type_var = tk.StringVar(value="all")
        self.rule_var = tk.StringVar()
        self.info_var = tk.StringVar(value="Enter the API URL and an admin token, then Refresh.")

        self.rules = []          # [{rule, label, description, appliesTo}]
        self.rule_labels = {}    # rule -> label
        self.reports = {}        # tree item id -> summary
        self.current = None      # selected report detail
        self._photo = None       # keep a reference, Tk drops images otherwise

        self._build()

    # ------------------------------------------------------------------ layout

    def _build(self):
        tk.Label(self, text="User reports", font=("Helvetica", 16, "bold"), fg="#2E86C1").pack(anchor="w", padx=10, pady=(5, 0))

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=5)
        tk.Label(bar, text="API URL").pack(side="left")
        tk.Entry(bar, textvariable=self.api_url_var, width=30).pack(side="left", padx=5)
        tk.Label(bar, text="Admin token").pack(side="left")
        tk.Entry(bar, textvariable=self.token_var, width=40, show="•").pack(side="left", padx=5)
        tk.Label(bar, text="Status").pack(side="left", padx=(10, 0))
        ttk.Combobox(bar, textvariable=self.status_var, values=STATUS_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Label(bar, text="Type").pack(side="left")
        ttk.Combobox(bar, textvariable=self.type_var, values=TYPE_OPTIONS, width=9, state="readonly").pack(side="left", padx=5)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left", padx=10)
        tk.Label(self, textvariable=self.info_var, fg="gray").pack(anchor="w", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=5)

        left = tk.Frame(body, width=760, height=600)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        columns = ("created", "type", "rule", "target", "reporter", "owner", "status")
        self.tree = ttk.Treeview(left, columns=columns, show="headings", selectmode="browse")
        widths = {"created": 115, "type": 65, "rule": 140, "target": 210, "reporter": 80, "owner": 80, "status": 70}
        for col in columns:
            self.tree.heading(col, text=col.capitalize())
            self.tree.column(col, width=widths[col], anchor="w")
        scroll = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scroll.pack(side="left", fill="y")
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        right = tk.Frame(body)
        right.pack(side="left", fill="both", expand=True, padx=(10, 0))
        self.image_label = tk.Label(right)
        self.image_label.pack(anchor="w")
        self.detail = ScrolledText(right, height=16, wrap="word", font=("Consolas", 10))
        self.detail.pack(fill="both", expand=True)
        self.detail.configure(state="disabled")

        actions = tk.LabelFrame(right, text="Decision (content rules only — never who was right in a deal)")
        actions.pack(fill="x", pady=5)
        row = tk.Frame(actions)
        row.pack(fill="x", padx=5, pady=3)
        tk.Label(row, text="Rule broken").pack(side="left")
        self.rule_combo = ttk.Combobox(row, textvariable=self.rule_var, width=40, state="readonly")
        self.rule_combo.pack(side="left", padx=5)
        tk.Label(actions, text="Statement of reasons (shown to the content author; never name the reporter):").pack(anchor="w", padx=5)
        self.statement = tk.Text(actions, height=3, wrap="word")
        self.statement.pack(fill="x", padx=5)
        buttons = tk.Frame(actions)
        buttons.pack(fill="x", padx=5, pady=5)
        self.remove_button = tk.Button(buttons, text="Remove content", bg="#C0392B", fg="white", command=self._remove)
        self.remove_button.pack(side="left")
        self.dismiss_button = tk.Button(buttons, text="No violation", command=self._dismiss)
        self.dismiss_button.pack(side="left", padx=10)
        self._set_actions_enabled(False)

    # ------------------------------------------------------------------ data

    def _api(self):
        return AdminApi(self.api_url_var.get(), self.token_var.get())

    def refresh(self):
        api = self._api()
        try:
            if not self.rules:
                self.rules = api.rules()
                self.rule_labels = {r["rule"]: r["label"] for r in self.rules}
            status = None if self.status_var.get() == "all" else self.status_var.get()
            target_type = None if self.type_var.get() == "all" else self.type_var.get()
            items = api.list_reports(status=status, target_type=target_type)
        except ApiError as e:
            self.info_var.set(f"Error: {e}")
            messagebox.showerror("Reports", str(e))
            return

        self.tree.delete(*self.tree.get_children())
        self.reports = {}
        for report in items:
            iid = self.tree.insert("", "end", values=short_row(report, self.rule_labels))
            self.reports[iid] = report
        self.info_var.set(f"{len(items)} report(s).")
        self._show(None)

    def _on_select(self, _event=None):
        selection = self.tree.selection()
        if not selection:
            return
        summary = self.reports.get(selection[0])
        try:
            detail = self._api().get_report(summary["id"])
        except ApiError as e:
            messagebox.showerror("Reports", str(e))
            return
        self._show(detail)

    def _show(self, detail):
        self.current = detail
        self.detail.configure(state="normal")
        self.detail.delete("1.0", "end")
        self.image_label.configure(image="", text="")
        self._photo = None
        if detail is None:
            self.detail.configure(state="disabled")
            self._set_actions_enabled(False)
            return

        self.detail.insert("1.0", format_report(detail, self.rule_labels))
        self.detail.configure(state="disabled")

        applicable = [r for r in self.rules if detail["targetType"] in r["appliesTo"]]
        self.rule_combo.configure(values=[r["label"] for r in applicable])
        self.rule_var.set(self.rule_labels.get(detail["rule"], ""))
        self.statement.delete("1.0", "end")
        self._set_actions_enabled(detail["status"] == "open")
        self._show_listing_image(detail)

    def _show_listing_image(self, detail):
        images = ((detail.get("snapshot") or {}).get("listing") or {}).get("images") or []
        if not images:
            return
        try:
            from PIL import Image, ImageTk
            data = self._api().listing_image(images[0])
            img = Image.open(io.BytesIO(data))
            img.thumbnail((220, 160))
            self._photo = ImageTk.PhotoImage(img)
            self.image_label.configure(image=self._photo)
        except Exception as e:  # image is a nice-to-have
            self.image_label.configure(text=f"(image not available: {e.__class__.__name__})")

    # ------------------------------------------------------------------ actions

    def _set_actions_enabled(self, enabled):
        state = "normal" if enabled else "disabled"
        self.remove_button.configure(state=state)
        self.dismiss_button.configure(state=state)

    def _selected_rule(self):
        label = self.rule_var.get()
        return next((r["rule"] for r in self.rules if r["label"] == label), None)

    def _remove(self):
        statement = self.statement.get("1.0", "end").strip()
        if len(statement) < 10:
            messagebox.showwarning("Remove content", "Write a statement of reasons (at least 10 characters).")
            return
        if not messagebox.askyesno("Remove content", "Remove this content and notify its author with your statement?"):
            return
        self._resolve("removed", self._selected_rule(), statement)

    def _dismiss(self):
        note = self.statement.get("1.0", "end").strip() or None
        self._resolve("no_violation", None, note)

    def _resolve(self, decision, rule, statement):
        try:
            detail = self._api().resolve(self.current["id"], decision, rule, statement)
        except ApiError as e:
            messagebox.showerror("Reports", str(e))
            return
        self.info_var.set(f"Resolved: {decision}.")
        selected = self.tree.selection()
        if selected:
            self.tree.item(selected[0], values=short_row(detail, self.rule_labels))
            self.reports[selected[0]] = detail
        self._show(detail)
