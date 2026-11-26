"""Write a readable Markdown page for each draft subject taxonomy.

    python backend/tools/subject_codes_doc.py

Reads backend/birdbrains/subjects/*.json and writes docs/subject-codes/<subject>.md.
The JSON files are the source of truth; rerun this after editing them.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from birdbrains import subjects  # noqa: E402

OUT = ROOT / "docs" / "subject-codes"


def page(subject: str) -> str:
    t = subjects.load(subject)
    lines = [
        f"# {t['name']} error codes (draft)",
        "",
        f"Generated from `backend/birdbrains/subjects/{subject}.json` by "
        "`backend/tools/subject_codes_doc.py`. Edit the JSON, not this page.",
        "",
        f"Courses: {', '.join(t['courses'])}. {len(t['codes'])} codes.",
        "",
        "| Pillar | Name | Points | Slip | Scope |",
        "|---|---|---|---|---|",
    ]
    for p in t["pillars"]:
        lines.append(f"| {p['id']} | {p['name']} | {p['max_score']} | {'yes' if p['slip'] else ''} | {p['scope']} |")
    for p in t["pillars"]:
        lines += ["", f"## {p['id']}: {p['name']}", ""]
        for c in t["codes"]:
            if c["pillar"] != p["id"]:
                continue
            lines += [
                f"### `{c['id']}` {c['name']}",
                "",
                f"- **Shown as:** {c['plain_name']}. _{c['student_help']}_",
                f"- **Means:** {c['description']}",
                f"- **Example:** {c['example']}",
            ]
            for ta in c["tell_apart"]:
                who = f"`{ta['code']}`" if ta["code"] else "Other"
                lines.append(f"- **Not {who}:** {ta['how']}")
            lines += [f"- **Next step:** {c['remediation']}", ""]
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for subject in subjects.subject_ids():
        (OUT / f"{subject}.md").write_text(page(subject), encoding="utf-8")
        print("wrote", OUT / f"{subject}.md")


if __name__ == "__main__":
    main()
