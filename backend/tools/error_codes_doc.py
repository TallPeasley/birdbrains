"""Write docs/ERROR_CODES.md from birdbrains/error_codes.json and docs/QUIRKS.md from
birdbrains/quirks.json.

    python backend/tools/error_codes_doc.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from birdbrains.codes import CODES  # noqa: E402
from birdbrains.quirks import QUIRKS  # noqa: E402
from birdbrains.taxonomy import PILLAR_MAX_SCORES, PILLAR_NAMES, PILLAR_SCOPES  # noqa: E402


def render() -> str:
    out = [
        "# Error codes",
        "",
        "Generated from `backend/birdbrains/error_codes.json` by `backend/tools/error_codes_doc.py`.",
        "Edit the JSON, not this file. Ids are internal: students and parents only ever see the",
        "plain name and the student help line.",
        "",
        f"{len(CODES)} codes in six pillars. Points per question: "
        + ", ".join(f"{p} {n}" for p, n in PILLAR_MAX_SCORES.items()) + ".",
    ]
    for pillar, title in PILLAR_NAMES.items():
        out += ["", f"## {title} ({pillar})", "", PILLAR_SCOPES[pillar]]
        for c in CODES.values():
            if c.pillar != pillar:
                continue
            out += ["", f"### {c.name}", "", f"`{c.id}`" + (f" (replaces {', '.join(c.legacy_ids)})" if c.legacy_ids else ""), ""]
            out.append(f"- **Shown to people:** {c.plain_name}. {c.student_help}")
            out.append(f"- **What it is:** {c.description}")
            out.append(f"- **Example:** {c.example}")
            for t in c.tell_apart:
                target = f" Use **{CODES[t.code].name}** (`{t.code}`)." if t.code else ""
                out.append(f"- **Not this:** {t.how}.{target}")
            out.append(f"- **Practice that helps:** {c.remediation}")
    return "\n".join(out) + "\n"


def render_quirks() -> str:
    out = [
        "# Quirks and antiquirks",
        "",
        "Generated from `backend/birdbrains/quirks.json` by `backend/tools/error_codes_doc.py`.",
        "Edit the JSON, not this file. Never reuse or delete an id: stored gradings name them.",
        "",
        "Every pillar has 4 checks (below). The grader marks each check MET, MISSED or",
        "NOT_TESTED on every question. Of a pillar's checks that apply, meeting at least",
        "two thirds earns the pillar's **quirk**, meeting a quarter or fewer gives its",
        "**antiquirk**, anything else is neutral: 3-4 of 4 = quirk, 2 = neutral, 0-1 =",
        "antiquirk; with fewer checks that apply, 2 of 3, 2 of 2 or 1 of 1 = quirk. A check",
        "is MISSED when its question has a root error it lists under \"cancelled by\"; the",
        "error codes (`ERROR_CODES.md`) stay the detailed reasons. On a page with several",
        "questions the pillar's checks are added up over every question (e.g. 3 of 4 plus 1",
        "of 3 = 4 of 7, neutral). All six pillars show on every upload, and quirks and antiquirks",
        "are tallied per pillar over time. Quirks never change a mark. Every plan gets them.",
    ]
    for pillar, title in PILLAR_NAMES.items():
        out += ["", f"## {title} ({pillar})"]
        for q in QUIRKS.values():
            if q.pillar != pillar:
                continue
            out += ["", f"### {q.plain_name}", "", f"`{q.id}`", ""]
            out.append(f"- **When met, the student sees:** {q.earned_line}")
            out.append(f"- **How to meet it:** {q.how_to_earn}")
            out.append(f"- **Grader rule:** {q.description}")
            out.append("- **Cancelled by:** " + ", ".join(f"{CODES[c].plain_name} (`{c}`)" for c in q.opposes))
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    path = ROOT.parent / "docs" / "ERROR_CODES.md"
    path.write_text(render(), encoding="utf-8")
    print(f"Wrote {path} ({len(CODES)} codes)")
    qpath = ROOT.parent / "docs" / "QUIRKS.md"
    qpath.write_text(render_quirks(), encoding="utf-8")
    print(f"Wrote {qpath} ({len(QUIRKS)} quirks)")
