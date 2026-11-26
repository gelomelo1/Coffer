"""Pure helpers of the Contribution tab (Shape What's Next): times, labels, the photo phase's source picker."""
import re
from datetime import datetime, timezone

REASONS = [
    ("justFinished", "One just finished"),
    ("communityTooSmall", "Community not big enough yet"),
    ("contributionFinished", "Contribution finished"),
    ("modelsInProgress", "New models in the works"),
]

LOCAL_FORMAT = "%Y-%m-%d %H:%M"


def parse_local(text):
    """'YYYY-MM-DD HH:MM' in this computer's time zone -> an aware UTC datetime (ValueError with a readable message)."""
    try:
        naive = datetime.strptime((text or "").strip(), LOCAL_FORMAT)
    except ValueError:
        raise ValueError("Write the date as YYYY-MM-DD HH:MM, e.g. 2026-12-10 20:00.") from None
    return naive.astimezone().astimezone(timezone.utc)


def parse_iso(iso):
    """An API timestamp ('…Z', up to 7 fraction digits) -> aware datetime, or None."""
    if not iso:
        return None
    text = iso.replace("Z", "+00:00")
    text = re.sub(r"(\.\d{6})\d+", r"\1", text)
    value = datetime.fromisoformat(text)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def format_local(iso):
    """An API timestamp shown in local time as 'YYYY-MM-DD HH:MM' ('' when missing)."""
    value = parse_iso(iso)
    return value.astimezone().strftime(LOCAL_FORMAT) if value else ""


def phase_label(phase):
    if phase.get("kind") == "photo":
        subject = phase.get("subject") or {}
        return f"Photos: {subject.get('name') or '(no subject)'}"
    names = [c.get("name", "") for c in sorted(phase.get("candidates") or [], key=lambda c: c.get("position", 0))]
    return "Vote: " + " / ".join(names)


def state_label(phase):
    state = phase.get("state", "")
    return "open (paused)" if state == "open" and not phase.get("active") else state


def winner_sources(phases):
    """Closed voting phases with a winner — what a photo phase can be made from — newest close first."""
    sources = [p for p in phases if p.get("kind") == "vote" and p.get("state") == "closed" and p.get("winnerCandidateId")]
    return sorted(sources, key=lambda p: parse_iso(p.get("closedAt")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)


def most_recent_source_id(phases):
    sources = winner_sources(phases)
    return sources[0]["id"] if sources else None


def reason_text(key):
    return dict(REASONS).get(key, key or "")


def phone_preview(settings, phase, now):
    """One line saying what the phone shows right now."""
    if not settings.get("enabled") or not phase:
        return f"No contribution period right now — {reason_text(settings.get('reason'))}"
    ends = parse_iso(phase.get("endsAt"))
    left = max((ends - now).total_seconds(), 0) if ends else 0
    days, rest = divmod(int(left), 86400)
    hours, rest = divmod(rest, 3600)
    minutes = rest // 60
    return f"{days} d {hours:02d}:{minutes:02d} left — {phase_label(phase)}"
