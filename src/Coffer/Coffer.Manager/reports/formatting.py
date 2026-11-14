"""Turns admin report DTOs into readable text for the Manager's Reports view."""
import json


def _date(iso):
    return (iso or "")[:16].replace("T", " ")


def _price(cents):
    if cents is None:
        return ""
    return f"€{cents / 100:.2f}"


def short_row(report, rule_labels):
    """One row of the report list: created, type, rule, target, reporter, owner, status."""
    return (
        _date(report.get("createdAt")),
        report.get("targetType", ""),
        rule_labels.get(report.get("rule"), report.get("rule", "")),
        (report.get("targetSummary") or "")[:80],
        (report.get("reporter") or {}).get("name", ""),
        (report.get("targetOwner") or {}).get("name", ""),
        report.get("status", "") if report.get("status") == "open" else (report.get("decision") or report.get("status", "")),
    )


def _transcript(lines):
    out = []
    for m in lines or []:
        kind = m.get("kind")
        if kind == "price_offer":
            text = f"[offer {_price(m.get('amountCents'))} · {m.get('status')}] {m.get('body') or ''}"
        elif kind == "meetup_proposal":
            text = f"[meetup {_date(m.get('at'))} @ {m.get('place')} · {m.get('status')}] {m.get('body') or ''}"
        elif kind == "system":
            text = f"(system) {m.get('body')}"
        else:
            text = m.get("body") or ""
        removed = "  [REMOVED]" if m.get("isRemoved") else ""
        out.append(f"  {_date(m.get('createdAt'))}  {m.get('sender')}: {text}{removed}")
    return "\n".join(out) if out else "  (empty)"


def format_report(report, rule_labels):
    """Full detail text: the report, who/what, frozen evidence, current state."""
    snap = report.get("snapshot") or {}
    owner = report.get("targetOwner") or {}
    reporter = report.get("reporter") or {}
    lines = [
        f"REPORT · {report.get('targetType', '').upper()} · {report.get('status', '').upper()}",
        f"Rule: {rule_labels.get(report.get('rule'), report.get('rule'))}",
        f"Reason: {report.get('reason')}",
        f"Reported by: {reporter.get('name')}  ·  {_date(report.get('createdAt'))}",
        f"Content author: {owner.get('name')}  (removals so far: {report.get('ownerPriorRemovals', 0)})",
        f"Open reports on this content: {report.get('openReportsOnTarget', 0)}",
    ]
    if report.get("decision"):
        lines.append(f"Decision: {report['decision']} · {report.get('statement') or ''}")
    lines.append("")
    lines.append("EVIDENCE (frozen when reported)")

    if "listing" in snap and report.get("targetType") == "listing":
        l = snap["listing"]
        lines += [
            f"  Title: {l.get('title')}",
            f"  Kind: {l.get('kind')} · Status: {l.get('status')} · Price: {_price(l.get('priceCents')) or '-'}",
            f"  Item type: {l.get('itemType')} · City: {l.get('city')} · Condition: {l.get('condition')}",
            f"  Private seller declared: {l.get('privateSellerDeclared')}",
            f"  Exchange for: {l.get('exchangeFor') or '-'}",
            "  Includes:",
        ]
        lines += [f"    • {x.get('name')} ×{x.get('quantity')}" for x in l.get("lines") or []]
        lines.append(f"  Description: {l.get('description') or '-'}")
        lines.append(f"  Images: {', '.join(l.get('images') or []) or '-'}")
    if "message" in snap:
        m = snap["message"]
        lines.append(f"  Message by {m.get('sender')} ({m.get('kind')}, {_date(m.get('createdAt'))}): {m.get('body')}")
        if m.get("payload"):
            lines.append(f"  Payload: {m.get('payload')}")
    if "review" in snap:
        r = snap["review"]
        lines.append(f"  Review by {r.get('reviewer')} as {r.get('reviewerRole')}: {r.get('stars')}★ "
                     f"[{r.get('reasonTag') or '-'}] {r.get('comment') or ''}")
        if r.get("reply"):
            lines.append(f"  Reply: {r.get('reply')}")
    if "deal" in snap:
        d = snap["deal"]
        lines.append(f"  Deal: {d.get('method')} · {d.get('status')} · {_price(d.get('agreedPriceCents'))} · "
                     f"seller {d.get('seller')} · buyer {d.get('buyer')}")
        if d.get("trackingNumber"):
            lines.append(f"  Tracking: {d.get('carrier')} {d.get('trackingNumber')}")
        if d.get("disputeReason"):
            lines.append(f"  Dispute: {d.get('disputeReason')}")
    if "listing" in snap and report.get("targetType") != "listing" and snap["listing"]:
        lines.append(f"  Listing: {snap['listing'].get('title')}")
    if "transcript" in snap:
        lines.append("  Chat:")
        lines.append(_transcript(snap["transcript"]))

    lines.append("")
    lines.append("CURRENT STATE")
    lines.append("  " + json.dumps(report.get("currentState") or {}, ensure_ascii=False))
    return "\n".join(lines)
