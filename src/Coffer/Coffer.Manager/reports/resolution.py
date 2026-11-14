"""Decision panel shared by the report views: one decision, one explanation, for one or many reports."""
import tkinter as tk
from tkinter import messagebox, ttk

DECISIONS = [
    ("removed", "Remove content"),
    ("removed+suspend", "Remove content + suspend author"),
    ("suspended", "Suspend author (keep content)"),
    ("no_violation", "No violation"),
]

DURATIONS = [("1 day", 24), ("3 days", 72), ("7 days", 168), ("14 days", 336), ("30 days", 720)]


def decision_payload(choice, duration_label):
    """(decision, suspensionHours) for the API from the panel's choice."""
    hours = dict(DURATIONS).get(duration_label)
    if choice == "removed+suspend":
        return "removed", hours
    if choice == "suspended":
        return "suspended", hours
    return choice, None


def validate(choice, statement):
    """Returns an error text, or None when the decision can be sent."""
    if len((statement or "").strip()) < 10:
        return "Write the explanation (at least 10 characters). It is stored on every selected report and shown to the author."
    return None


class ResolutionPanel(tk.LabelFrame):
    """
    on_resolve(decision, rule_or_None, statement, suspension_hours) is called after confirmation.
    count_text() gives the "this affects N reports" sentence shown in the confirmation.
    """

    def __init__(self, parent, on_resolve, count_text):
        super().__init__(parent, text="Decision (content rules only — never who was right in a deal)")
        self.on_resolve = on_resolve
        self.count_text = count_text
        self.choice_var = tk.StringVar(value="removed")
        self.rule_var = tk.StringVar()
        self.duration_var = tk.StringVar(value=DURATIONS[1][0])
        self.affected_var = tk.StringVar(value="")
        self.rules = []

        row = tk.Frame(self)
        row.pack(fill="x", padx=5, pady=2)
        for value, label in DECISIONS:
            tk.Radiobutton(row, text=label, value=value, variable=self.choice_var, command=self._sync).pack(side="left")

        row2 = tk.Frame(self)
        row2.pack(fill="x", padx=5, pady=2)
        tk.Label(row2, text="Rule broken").pack(side="left")
        self.rule_combo = ttk.Combobox(row2, textvariable=self.rule_var, width=34, state="readonly")
        self.rule_combo.pack(side="left", padx=5)
        tk.Label(row2, text="Suspension").pack(side="left", padx=(10, 0))
        self.duration_combo = ttk.Combobox(row2, textvariable=self.duration_var, values=[d[0] for d in DURATIONS], width=9, state="readonly")
        self.duration_combo.pack(side="left", padx=5)

        tk.Label(self, text="Explanation (statement of reasons — shown to the author and to the reporters; never name the reporter):").pack(anchor="w", padx=5)
        self.statement = tk.Text(self, height=3, wrap="word")
        self.statement.pack(fill="x", padx=5)

        bottom = tk.Frame(self)
        bottom.pack(fill="x", padx=5, pady=4)
        self.button = tk.Button(bottom, text="Apply decision", bg="#C0392B", fg="white", command=self._apply)
        self.button.pack(side="left")
        tk.Label(bottom, textvariable=self.affected_var, fg="gray").pack(side="left", padx=10)
        self.set_enabled(False)
        self._sync()

    # ------------------------------------------------------------------ state

    def set_rules(self, rules, target_types):
        """Only rules that apply to every selected content type are offered."""
        self.rules = [r for r in rules if all(t in r["appliesTo"] for t in target_types)] if target_types else []
        self.rule_combo.configure(values=["(keep each report's rule)"] + [r["label"] for r in self.rules])
        self.rule_var.set("(keep each report's rule)")

    def set_affected(self, text):
        self.affected_var.set(text)

    def set_enabled(self, enabled):
        self.button.configure(state="normal" if enabled else "disabled")

    def clear(self):
        self.statement.delete("1.0", "end")

    def _sync(self):
        choice = self.choice_var.get()
        self.duration_combo.configure(state="readonly" if choice in ("suspended", "removed+suspend") else "disabled")
        self.rule_combo.configure(state="disabled" if choice == "no_violation" else "readonly")

    def selected_rule(self):
        label = self.rule_var.get()
        return next((r["rule"] for r in self.rules if r["label"] == label), None)

    # ------------------------------------------------------------------ action

    def _apply(self):
        choice = self.choice_var.get()
        statement = self.statement.get("1.0", "end").strip()
        error = validate(choice, statement)
        if error:
            messagebox.showwarning("Decision", error)
            return
        decision, hours = decision_payload(choice, self.duration_var.get())
        label = dict(DECISIONS)[choice]
        extra = f"\nThe author will be suspended for {self.duration_var.get()}." if hours else ""
        if not messagebox.askyesno("Confirm decision", f"{label}.\n{self.count_text()}{extra}\n\nApply?"):
            return
        self.on_resolve(decision, None if decision == "no_violation" else self.selected_rule(), statement, hours)
