"""Write docs/ERROR_CODES.md from birdbrains/error_codes.json.

    python backend/tools/error_codes_doc.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from birdbrains.codes import CODES  # noqa: E402
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


if __name__ == "__main__":
    path = ROOT.parent / "docs" / "ERROR_CODES.md"
    path.write_text(render(), encoding="utf-8")
    print(f"Wrote {path} ({len(CODES)} codes)")
