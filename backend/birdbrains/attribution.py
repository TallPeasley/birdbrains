"""Where Quark's visitors and accounts come from.

The site records a *touch* for each arrival: the UTM tags and referral code in the link,
the host of the page that linked to Quark, the landing page, and which ad click ids
were present (never their values). With the visitor's consent it keeps the first and
latest touch in first-party cookies and sends one anonymous visit a day; at sign-up it
sends both touches with the registration (see lib/attribution.ts).

Nothing here holds a name, email, IP address or user agent. ``summary`` is what the
growth dashboard in Planck reads, through ``GET /internal/attribution``.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

CHANNELS = ("Referral code", "Paid", "Email", "Social", "Organic search", "Referral link", "Campaign", "Direct")

_SEARCH = ("google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "baidu.", "yandex.", "search.brave.")
_SOCIAL = ("facebook.", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "lnkd.in", "reddit.",
           "tiktok.", "youtube.", "pinterest.", "snapchat.", "threads.net", "whatsapp.", "discord.")
_SOCIAL_SOURCES = {"facebook", "fb", "instagram", "ig", "twitter", "x", "linkedin", "reddit", "tiktok",
                   "youtube", "pinterest", "snapchat", "threads", "whatsapp", "discord"}
_PAID_MEDIUMS = {"cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-social", "paid_social", "display",
                 "cpm", "ads", "ad"}


def _host_matches(host: str, needles: Iterable[str]) -> bool:
    host = host.lower()
    return any(n in host for n in needles)


def channel(touch: Optional[dict]) -> str:
    """Sort one touch into a marketing channel (first match wins, in CHANNELS order)."""
    if not touch:
        return "Direct"
    source = (touch.get("source") or "").lower()
    medium = (touch.get("medium") or "").lower()
    host = (touch.get("referrerHost") or "").lower()
    if touch.get("ref"):
        return "Referral code"
    if touch.get("clickIds") or medium in _PAID_MEDIUMS:
        return "Paid"
    if medium in {"email", "e-mail", "newsletter"}:
        return "Email"
    if medium in {"social", "social-media", "sm"} or source in _SOCIAL_SOURCES or _host_matches(host, _SOCIAL):
        return "Social"
    if medium == "organic" or (host and _host_matches(host, _SEARCH)):
        return "Organic search"
    if host:
        return "Referral link"
    if source or touch.get("campaign"):
        return "Campaign"
    return "Direct"


def source_label(touch: Optional[dict]) -> str:
    """'source / medium' for tagged links, else the referring host, else '(direct)'."""
    if not touch:
        return "(direct)"
    if touch.get("source"):
        return f"{touch['source']} / {touch.get('medium') or '(none)'}"
    if touch.get("ref"):
        return f"ref:{touch['ref']}"
    return touch.get("referrerHost") or "(direct)"


def since_iso(days: int, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat()  # same format as api.now_iso, so string comparison works


def _day(iso: str) -> str:
    return (iso or "")[:10]


def summary(users: list[dict], visits: list[dict], days: int, now: Optional[datetime] = None) -> dict:
    """The dashboard payload: totals, channels (visits, sign-ups, conversion, paid),
    first-touch sources and campaigns, referral codes, referring sites, landing pages, a
    daily series, and the latest sign-ups (role, course, channel; no names).

    Sign-ups are credited to their first touch (how they first found Quark); the latest
    touch is reported beside it."""
    now = now or datetime.now(timezone.utc)
    start = since_iso(days, now)
    users = [u for u in users if (u.get("createdAt") or "") >= start]
    visits = [v for v in visits if (v.get("at") or "") >= start]

    def first(u: dict) -> Optional[dict]:
        a = u.get("attribution") or {}
        return a.get("first") or a.get("last")

    ch_visits = Counter(v.get("channel") or channel(v) for v in visits)
    ch_signups: Counter = Counter()
    ch_paid: Counter = Counter()
    ch_last: Counter = Counter()
    sources: dict[str, Counter] = defaultdict(Counter)
    campaigns: dict[str, Counter] = defaultdict(Counter)
    referrers: dict[str, Counter] = defaultdict(Counter)
    landings: dict[str, Counter] = defaultdict(Counter)
    roles = Counter()
    for v in visits:
        sources[source_label(v)]["visits"] += 1
        if v.get("campaign"):
            campaigns[v["campaign"]]["visits"] += 1
        if v.get("referrerHost"):
            referrers[v["referrerHost"]]["visits"] += 1
        if v.get("landingPath"):
            landings[v["landingPath"]]["visits"] += 1
    for u in users:
        t = first(u)
        ch = channel(t)
        paid = u.get("plan") == "pro" or bool(u.get("stripeCustomerId"))
        ch_signups[ch] += 1
        ch_paid[ch] += paid
        last = (u.get("attribution") or {}).get("last")
        ch_last[channel(last) if last else ch] += 1
        roles[u.get("role", "unknown")] += 1
        sources[source_label(t)]["signups"] += 1
        sources[source_label(t)]["paid"] += paid
        if t and t.get("campaign"):
            campaigns[t["campaign"]]["signups"] += 1
            campaigns[t["campaign"]]["paid"] += paid
        if t and t.get("referrerHost"):
            referrers[t["referrerHost"]]["signups"] += 1
        if t and t.get("landingPath"):
            landings[t["landingPath"]]["signups"] += 1

    def rate(signups: int, visits_: int) -> Optional[float]:
        return round(signups / visits_, 4) if visits_ else None

    def table(d: dict[str, Counter], key: str, limit: int = 25) -> list[dict]:
        rows = [{key: k, "visits": c["visits"], "signups": c["signups"], "paid": c["paid"],
                 "conversion": rate(c["signups"], c["visits"])} for k, c in d.items()]
        rows.sort(key=lambda r: (-r["signups"], -r["visits"], r[key]))
        return rows[:limit]

    referral_codes = Counter()
    referral_paid = Counter()
    for u in users:
        code = (first(u) or {}).get("ref") or ((u.get("attribution") or {}).get("last") or {}).get("ref")
        if code:
            referral_codes[code] += 1
            referral_paid[code] += u.get("plan") == "pro" or bool(u.get("stripeCustomerId"))

    series = []
    d0 = datetime.fromisoformat(start)
    by_day_v = Counter(_day(v.get("at", "")) for v in visits)
    by_day_s = Counter(_day(u.get("createdAt", "")) for u in users)
    for i in range(days + 1):
        day = (d0 + timedelta(days=i)).date().isoformat()
        if day > now.date().isoformat():
            break
        series.append({"day": day, "visits": by_day_v[day], "signups": by_day_s[day]})

    recent = sorted(users, key=lambda u: u.get("createdAt", ""), reverse=True)[:25]
    return {
        "days": days,
        "since": start,
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "totals": {
            "visits": len(visits),
            "signups": len(users),
            "paid": sum(ch_paid.values()),
            "conversion": rate(len(users), len(visits)),
            "byRole": dict(roles),
        },
        "channels": [
            {"channel": c, "visits": ch_visits[c], "signups": ch_signups[c], "lastTouchSignups": ch_last[c],
             "paid": ch_paid[c], "conversion": rate(ch_signups[c], ch_visits[c])}
            for c in CHANNELS if ch_visits[c] or ch_signups[c] or ch_last[c]
        ],
        "sources": table(sources, "source"),
        "campaigns": table(campaigns, "campaign"),
        "referrers": table(referrers, "host"),
        "landingPages": table(landings, "path", 15),
        "referralCodes": [{"code": k, "signups": n, "paid": referral_paid[k]}
                          for k, n in referral_codes.most_common(25)],
        "daily": series,
        "recentSignups": [
            {"at": u.get("createdAt"), "role": u.get("role"), "course": u.get("course"),
             "channel": channel(first(u)), "source": source_label(first(u)),
             "campaign": (first(u) or {}).get("campaign"),
             "paid": u.get("plan") == "pro" or bool(u.get("stripeCustomerId"))}
            for u in recent
        ],
        "notes": [
            "Visits are counted only for visitors who allowed cookies, once per visitor per day.",
            "Sign-ups are credited to their first touch; lastTouchSignups credits the latest one.",
            "Accounts made before attribution was added count as Direct.",
        ],
    }
