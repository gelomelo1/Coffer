"""The test-set report of a run: report.json for the Manager, report.md to read."""
import json
import os

from training.metrics import compare

KEYS = {
    "embedding": ["r1", "r5", "r10", "map_at_r"],
    "detection": ["precision", "recall", "f1", "map50", "map50_95"],
}
LABELS = {
    "r1": "Recall@1", "r5": "Recall@5", "r10": "Recall@10", "map_at_r": "MAP@R",
    "precision": "Precision", "recall": "Recall", "f1": "F1", "map50": "mAP50", "map50_95": "mAP50-95",
}
HEADLINE = {"embedding": "r1", "detection": "map50_95"}


def _fmt(value):
    return "—" if value is None else f"{value:.3f}"


def write_report(run_dir: str, kind: str, new: dict, live, test_size: dict, thresholds: dict) -> dict:
    rows = compare(new, live, KEYS[kind])
    key = HEADLINE[kind]
    main = next(r for r in rows if r["metric"] == key)
    headline = f"{LABELS[key]} {_fmt(main['new'])}" + (f" ({main['delta']:+.3f})" if main["delta"] is not None else "")
    data = {"kind": kind, "new": new, "live": live, "rows": rows, "test_size": test_size,
            "thresholds": thresholds, "headline": headline}
    with open(os.path.join(run_dir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    size = ", ".join(f"{v} {k}" for k, v in test_size.items())
    lines = [f"# {kind.capitalize()} model — test-set report", "", f"Test set: {size}.", "",
             "| Metric | Live model | New model | Change |", "|---|---:|---:|---:|"]
    for r in rows:
        change = "—" if r["delta"] is None else f"{r['delta']:+.3f}"
        lines.append(f"| {LABELS[r['metric']]} | {_fmt(r['live'])} | {_fmt(r['new'])} | {change} |")
    lines.append("")
    if live is None:
        lines.append("No live model to compare with (no item type chosen, or it has no model yet).")
    lines.append("Small test sets make small differences unreliable: with 50 queries one query is 0.02.")
    lines.append("")
    lines.append("Thresholds saved in the model: " + ", ".join(f"{k} {v}" for k, v in thresholds.items()) + ".")
    with open(os.path.join(run_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return data
