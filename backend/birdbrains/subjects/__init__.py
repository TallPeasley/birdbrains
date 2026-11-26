"""Draft error-code taxonomies for subjects other than maths.

One JSON file per subject sits next to this module (chemistry.json, ...). They
follow the shape of the maths list in ``error_codes.json``: six pillars with the
same ids (CON STR PRC FAC COM TST), and codes with readable ids whose prefix is
their pillar. Pillar names and scopes are set per subject.

These are NOT wired into grading yet: the pipeline and prompts are maths-only.
See docs/SUBJECT_TAXONOMIES.md.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).parent

PILLAR_IDS = ("CON", "STR", "PRC", "FAC", "COM", "TST")


def subject_ids() -> list[str]:
    """Every subject with a taxonomy file, e.g. ['biology', 'chemistry', ...]."""
    return sorted(p.stem for p in _DIR.glob("*.json"))


@lru_cache(maxsize=None)
def load(subject: str) -> dict:
    path = _DIR / f"{subject}.json"
    if not path.is_file():
        raise KeyError(f"no taxonomy for subject {subject!r}")
    return json.loads(path.read_text(encoding="utf-8"))


def codes_by_id(subject: str) -> dict[str, dict]:
    return {c["id"]: c for c in load(subject)["codes"]}


def taxonomy_text(subject: str) -> str:
    """Prompt-ready text for a subject, in the same layout as the maths taxonomy."""
    t = load(subject)
    lines = [
        f"# Six-Pillar Error Taxonomy: {t['name']}",
        "",
        f"Every root-cause error is assigned exactly one pillar and exactly one of the {len(t['codes'])}",
        "error codes below. The code's three-letter prefix IS its pillar. Never invent a",
        "code outside this list.",
        "",
        "To choose the pillar, ask in order: " + " ".join(t["decision_order"]),
    ]
    for p in t["pillars"]:
        lines += ["", f"## {p['id']}: {p['name']}", p["scope"]]
        for c in t["codes"]:
            if c["pillar"] != p["id"]:
                continue
            lines.append(f"- {c['id']} ({c['name']}): {c['description']} Example: {c['example']}")
            for ta in c["tell_apart"]:
                lines.append(f"  - Not to confuse: {ta['how']}")
    return "\n".join(lines) + "\n"
