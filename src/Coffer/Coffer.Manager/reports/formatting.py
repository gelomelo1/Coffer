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


def content_row(group, rule_labels):
    """One row of the "Reported content" list: type, what, owner, reports, open, reasons, reporters, last report."""
    statuses = group.get("statuses") or {}
    return (
        group.get("targetType", ""),
        (group.get("targetSummary") or "")[:70],
        (group.get("owner") or {}).get("name", ""),
        group.get("reportCount", 0),
        group.get("openCount", 0),
        ", ".join(rule_labels.get(r, r) for r in group.get("rules") or []),
        ", ".join((u or {}).get("name", "") for u in group.get("reporters") or []),
        " ".join(f"{k}:{v}" for k, v in sorted(statuses.items())),
        _date(group.get("latestReportAt")),
    )


def suspension_row(s):
    """created, user, status, starts, ends, by, reason."""
    return (
        _date(s.get("createdAt")),
        (s.get("user") or {}).get("name", ""),
        s.get("status", ""),
        _date(s.get("startsAt")),
        _date(s.get("endsAt")),
        (s.get("createdBy") or {}).get("login", ""),
        (s.get("reason") or "")[:80],
    )


def format_suspension(s):
    lines = [
        f"SUSPENSION · {s.get('status', '').upper()}",
        f"User: {(s.get('user') or {}).get('name')}",
        f"From {_date(s.get('startsAt'))} until {_date(s.get('endsAt'))}",
        f"By: {(s.get('createdBy') or {}).get('login', '?')}",
        f"Reason: {s.get('reason')}",
    ]
    if s.get("sourceReportId"):
        lines.append(f"From report: {s.get('sourceReportId')}")
    if s.get("revokedAt"):
        lines.append(f"Revoked {_date(s.get('revokedAt'))} by {(s.get('revokedBy') or {}).get('login', '?')}: {s.get('revokeReason')}")
    return "\n".join(lines)


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


def format_content(detail, rule_labels):
    """Detail text of a reported piece of content: aggregate, every report, latest evidence, current state."""
    g = detail.get("content") or {}
    owner = g.get("owner") or {}
    lines = [
        f"REPORTED {g.get('targetType', '').upper()} · {g.get('reportCount', 0)} report(s), {g.get('openCount', 0)} open",
        f"What: {g.get('targetSummary')}",
        f"Author: {owner.get('name')}  (removals so far: {detail.get('ownerPriorRemovals', 0)})",
    ]
    if detail.get("ownerActiveSuspension"):
        lines.append(f"Author is SUSPENDED until {_date(detail['ownerActiveSuspension'].get('endsAt'))}")
    lines.append("")
    lines.append("REPORTS")
    for r in detail.get("reports") or []:
        state = r.get("status") if r.get("status") == "open" else f"{r.get('decision')}: {r.get('statement') or ''}"
        lines.append(f"  {_date(r.get('createdAt'))}  {(r.get('reporter') or {}).get('name')} · "
                     f"{rule_labels.get(r.get('rule'), r.get('rule'))} · {state}")
        lines.append(f"      “{r.get('reason')}”")
    lines.append("")
    fake = {"targetType": g.get("targetType"), "snapshot": detail.get("latestSnapshot") or {}}
    evidence = format_report({**fake, "status": "", "currentState": detail.get("currentState")}, rule_labels)
    lines.append(evidence[evidence.index("EVIDENCE"):])
    return "\n".join(lines)


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
    if report.get("ownerActiveSuspension"):
        lines.append(f"Author is SUSPENDED until {_date(report['ownerActiveSuspension'].get('endsAt'))}")
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
    if "item" in snap and report.get("targetType") == "item":
        i = snap["item"] or {}
        lines += [
            f"  Item: {i.get('description') or '(no description)'}",
            f"  Collection: {i.get('collection')} ({i.get('type')}) · owner {i.get('owner')} · quantity {i.get('quantity')}",
            f"  Image: {i.get('image')}",
        ]
        lines += [f"    {a.get('name')}: {a.get('value')}" for a in i.get("attributes") or []]
        if i.get("tags"):
            lines.append("  Tags: " + " ".join("#" + t for t in i.get("tags")))
    if "comment" in snap:
        cm = snap["comment"] or {}
        lines.append(f"  Comment by {cm.get('author')} ({_date(cm.get('createdAt'))}): {cm.get('body')}")
        if snap.get("parent"):
            lines.append(f"  In reply to {snap['parent'].get('author')}: {snap['parent'].get('body')}")
        item = snap.get("item") or {}
        lines.append(f"  On item: {item.get('description') or '(no description)'} · collection {item.get('collection')}")
        if snap.get("thread"):
            lines.append("  Thread:")
            for t in snap["thread"]:
                flag = "  [DELETED]" if t.get("deleted") else "  [REMOVED]" if t.get("isRemoved") else ""
                marker = "  <-- reported" if t.get("id") == cm.get("id") else ""
                lines.append(f"    {_date(t.get('createdAt'))}  {t.get('author')}: {t.get('body')}{flag}{marker}")
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
