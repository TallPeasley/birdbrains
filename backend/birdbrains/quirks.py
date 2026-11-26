"""Quirks: the strengths the grader can award, loaded from ``quirks.json``.

Quirk is a play on the product name. Mistakes (the error codes in
``error_codes.json``) are shown to people as *antiquirks*; good work earns *quirks*.
Like the error codes, quirk ids are internal: people only see the plain name and
the one-line reason. The site imports the same JSON (``lib/quirks.ts``).

Quirks never change a mark. A quirk counts at most once per question and once per
upload, and a quirk is dropped when the same question has an antiquirk it opposes
(no "Included units" alongside "Missing units").
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Iterable, Optional, Sequence

from .codes import CODES, current_code

if TYPE_CHECKING:  # pragma: no cover
    from .schemas import QuestionGradingOutput

_DATA = json.loads((Path(__file__).with_name("quirks.json")).read_text(encoding="utf-8"))

# Most quirks one question can earn. Keeps praise specific rather than a shower of badges.
MAX_PER_QUESTION = 3


@dataclass(frozen=True)
class Quirk:
    id: str
    pillar: str
    plain_name: str
    earned_line: str
    how_to_earn: str
    description: str
    opposes: tuple[str, ...]


QUIRKS: dict[str, Quirk] = {
    q["id"]: Quirk(
        id=q["id"], pillar=q["pillar"], plain_name=q["plain_name"], earned_line=q["earned_line"],
        how_to_earn=q["how_to_earn"], description=q["description"], opposes=tuple(q["opposes"]),
    )
    for q in _DATA["quirks"]
}

QUIRK_PATTERN = "^(" + "|".join(QUIRKS) + ")$"


def quirk_pillar(quirk_id: str) -> str:
    return QUIRKS[quirk_id].pillar if quirk_id in QUIRKS else quirk_id[3:6]


def clean_question_quirks(q: "QuestionGradingOutput") -> "QuestionGradingOutput":
    """Drop quirks the rest of the question contradicts, repeats, and any beyond the cap.

    A quirk goes when the question has a root antiquirk the quirk opposes, when its
    step is a wrong line, or when the student left the question blank.
    """
    roots = {current_code(e.error_code) for e in q.identified_errors if not e.is_cascading_consequence}
    step_codes = {current_code(s.error_code) for s in q.step_evaluations if s.error_code and not s.is_correct}
    wrong_steps = {s.step_number for s in q.step_evaluations if not s.is_correct}
    blank = "TST_BLANK" in roots or not q.step_evaluations
    kept = []
    seen: set[str] = set()
    for earned in q.earned_quirks:
        quirk = QUIRKS.get(earned.quirk_id)
        if quirk is None or earned.quirk_id in seen or blank:
            continue
        if set(quirk.opposes) & (roots | step_codes):
            continue
        if earned.step_number is not None and earned.step_number in wrong_steps:
            continue
        seen.add(earned.quirk_id)
        kept.append(earned)
        if len(kept) == MAX_PER_QUESTION:
            break
    if kept == list(q.earned_quirks):
        return q
    return q.model_copy(update={"earned_quirks": kept})


def quirks_text() -> str:
    """The quirk list for the cached grading context."""
    from .taxonomy import PILLAR_NAMES

    lines = [
        "# Quirks (strengths to reward)",
        "",
        "Besides errors, notice what the student did WELL. For each question, award up",
        f"to {MAX_PER_QUESTION} quirks from the list below in `earned_quirks`, each with the",
        "`step_number` that shows it (null if it is about the whole question) and a short",
        "`evidence` sentence to the student naming exactly what they did. Award a quirk",
        "only with clear evidence on the page, never as a consolation prize, never for a",
        "blank question, and never when the same question has an error the quirk",
        "contradicts. An empty list is fine. Quirks never change the pillar scores.",
    ]
    for pillar, title in PILLAR_NAMES.items():
        lines += ["", f"## {pillar}: {title}"]
        for q in QUIRKS.values():
            if q.pillar == pillar:
                lines.append(f"- {q.id} ({q.plain_name}): {q.description}")
    return "\n".join(lines) + "\n"


def grading_quirk_ids(stage2_questions: Sequence["QuestionGradingOutput"]) -> list[str]:
    """Unique quirk ids earned on one upload, in first-seen order."""
    out: list[str] = []
    for q in stage2_questions:
        for e in q.earned_quirks:
            if e.quirk_id in QUIRKS and e.quirk_id not in out:
                out.append(e.quirk_id)
    return out


def collection(gradings: Iterable[tuple[str, Sequence[str]]]) -> list[dict]:
    """Lifetime counts from (gradedAt, quirk ids) pairs, one pair per upload.

    Every quirk is listed (earned or not) so the site can show empty slots, with how
    many uploads earned it and when it was first and last earned.
    """
    counts: dict[str, int] = {}
    first: dict[str, str] = {}
    last: dict[str, str] = {}
    for graded_at, ids in gradings:
        for qid in set(ids):
            if qid not in QUIRKS:
                continue
            counts[qid] = counts.get(qid, 0) + 1
            if qid not in first or graded_at < first[qid]:
                first[qid] = graded_at
            if qid not in last or graded_at > last[qid]:
                last[qid] = graded_at
    return [
        dict(quirkId=qid, pillar=q.pillar, count=counts.get(qid, 0),
             firstEarnedAt=first.get(qid), lastEarnedAt=last.get(qid))
        for qid, q in QUIRKS.items()
    ]


def _check() -> None:
    """Every `opposes` entry names a real error code (run by the tests)."""
    for q in QUIRKS.values():
        for code in q.opposes:
            if code not in CODES:
                raise ValueError(f"{q.id} opposes unknown code {code}")


def quirk(quirk_id: str) -> Optional[Quirk]:
    return QUIRKS.get(quirk_id)
