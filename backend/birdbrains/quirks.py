"""Quirks and antiquirks, scored per pillar from 4 checks each (``quirks.json``).

Quirk is a play on the product name. Every pillar has 4 checks (24 in all). The
grader marks every check MET, MISSED or NOT_TESTED on every question. For each
pillar, of the checks that apply (MET or MISSED):

* met at least two thirds -> the pillar's **quirk** (3-4 of 4, 2 of 3, 2 of 2, 1 of 1)
* met a quarter or fewer -> the pillar's **antiquirk** (0-1 of 4, 0 of 3, 0 of 2 ...)
* anything else -> neutral (2 of 4, 1 of 3, 1 of 2)
* no check applies -> not shown

Checks that don't apply are skipped and the rule scales (Maalik, 2026-11-26). Every
pillar is shown on every upload, and both quirks and antiquirks are tallied over time.
Quirks never change a mark. Ids are internal; the site imports the same JSON
(``lib/quirks.ts``) and shows plain names only.

The error codes stay the detailed reasons: a check is forced to MISSED when its
question has a root error the check ``opposes``.
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

PILLARS = ("CON", "STR", "PRC", "FAC", "COM", "TST")
MET, MISSED, NOT_TESTED = "MET", "MISSED", "NOT_TESTED"
QUIRK, NEUTRAL, ANTIQUIRK, NOT_SHOWN = "QUIRK", "NEUTRAL", "ANTIQUIRK", "NOT_SHOWN"


@dataclass(frozen=True)
class Quirk:
    """One check (the name "quirk" is kept for the ids and the JSON file)."""

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
CHECKS = QUIRKS  # clearer name for new code

QUIRK_PATTERN = "^(" + "|".join(QUIRKS) + ")$"


def pillar_status(met: int, tested: int) -> str:
    """The pillar result from how many of its applicable checks were met."""
    if tested == 0:
        return NOT_SHOWN
    if met * 3 >= tested * 2:
        return QUIRK
    if met * 4 <= tested:
        return ANTIQUIRK
    return NEUTRAL


def clean_requirement_checks(q: "QuestionGradingOutput") -> "QuestionGradingOutput":
    """Exactly one entry per check, in list order, with the rules enforced:

    * a missing or unknown entry becomes NOT_TESTED (duplicates keep the first);
    * a check whose ``opposes`` includes a root error on this question is MISSED;
    * a MET check pointing at a wrong line becomes NOT_TESTED (no evidence for it);
    * a blank question has nothing MET.
    """
    from .schemas import CheckStatusEnum, RequirementCheck

    roots = {current_code(e.error_code) for e in q.identified_errors if not e.is_cascading_consequence}
    wrong_steps = {s.step_number for s in q.step_evaluations if not s.is_correct}
    blank = "TST_BLANK" in roots or not q.step_evaluations
    given: dict[str, RequirementCheck] = {}
    for c in q.requirement_checks:
        if c.check_id in QUIRKS and c.check_id not in given:
            given[c.check_id] = c
    out = []
    for check in QUIRKS.values():
        c = given.get(check.id) or RequirementCheck(check_id=check.id, status=CheckStatusEnum.NOT_TESTED, evidence="")
        clash = sorted(set(check.opposes) & roots)
        if clash:
            if c.status != MISSED:
                c = c.model_copy(update={"status": CheckStatusEnum.MISSED, "evidence": CODES[clash[0]].student_help
                                         if not c.evidence or c.status == MET else c.evidence,
                                         "step_number": None if c.status == MET else c.step_number})
        elif c.status == MET and (blank or (c.step_number is not None and c.step_number in wrong_steps)):
            c = c.model_copy(update={"status": CheckStatusEnum.NOT_TESTED, "evidence": "", "step_number": None})
        out.append(c)
    return q.model_copy(update={"requirement_checks": out})


def question_pillars(q: "QuestionGradingOutput") -> dict[str, dict]:
    """pillar -> {status, met, tested, checks: [RequirementCheck ...]} for one question."""
    by_id = {c.check_id: c for c in q.requirement_checks}
    out = {}
    for p in PILLARS:
        checks = [by_id[c.id] for c in QUIRKS.values() if c.pillar == p and c.id in by_id]
        met = sum(1 for c in checks if c.status == MET)
        tested = sum(1 for c in checks if c.status in (MET, MISSED))
        out[p] = dict(status=pillar_status(met, tested), met=met, tested=tested, checks=checks)
    return out


def upload_check_statuses(questions: Sequence["QuestionGradingOutput"]) -> dict[str, tuple[str, Optional[str]]]:
    """check id -> (status, question label it came from) for a whole upload.

    A check shows as MET on the upload when it was met on more of its questions than it
    was missed, MISSED when it was missed at least as often, NOT_TESTED otherwise. The
    label is the first question that gave that status. (The pillar result itself adds
    up the checks over every question: see ``upload_pillar_counts``.)
    """
    multi = len(questions) > 1
    out: dict[str, tuple[str, Optional[str]]] = {}
    for check in QUIRKS.values():
        met_q, missed_q = [], []
        for q in questions:
            for c in q.requirement_checks:
                if c.check_id == check.id:
                    (met_q if c.status == MET else missed_q if c.status == MISSED else []).append(q.question_number)
                    break
        if not met_q and not missed_q:
            out[check.id] = (NOT_TESTED, None)
        elif len(met_q) > len(missed_q):
            out[check.id] = (MET, met_q[0] if multi else None)
        else:
            out[check.id] = (MISSED, missed_q[0] if multi else None)
    return out


def upload_pillar_counts(questions: Sequence["QuestionGradingOutput"]) -> dict[str, tuple[int, int]]:
    """pillar -> (checks met, checks that applied), added up over every question."""
    totals = {p: [0, 0] for p in PILLARS}
    for q in questions:
        for p, r in question_pillars(q).items():
            totals[p][0] += r["met"]
            totals[p][1] += r["tested"]
    return {p: (m, t) for p, (m, t) in totals.items()}


def upload_pillar_statuses(questions: Sequence["QuestionGradingOutput"]) -> dict[str, str]:
    """pillar -> QUIRK / NEUTRAL / ANTIQUIRK / NOT_SHOWN for a whole upload: the same
    rule as one question, over every check on every question."""
    return {p: pillar_status(m, t) for p, (m, t) in upload_pillar_counts(questions).items()}


def quirks_text() -> str:
    """The checks for the cached grading context."""
    from .taxonomy import PILLAR_NAMES

    lines = [
        "# Quirk checks (4 per pillar)",
        "",
        "Besides errors, judge the student against every check below on every question,",
        "in `requirement_checks`: one entry per check id, in this order, each with `status`",
        "MET (the work clearly shows it), MISSED (the question called for it and the",
        "student fell short) or NOT_TESTED (this question gives no chance to show it, e.g.",
        "no units involved, only one possible answer). For MET and MISSED give the",
        "`step_number` that shows it (null if it is about the whole question) and one short",
        "`evidence` sentence to the student naming exactly what they did or missed. Mark MET",
        "only with clear evidence on the page, never as a consolation prize. A check is",
        "MISSED whenever the question has a root error that check is about. A blank",
        "question has nothing MET. These checks never change the pillar scores.",
    ]
    for pillar, title in PILLAR_NAMES.items():
        lines += ["", f"## {pillar}: {title}"]
        for q in QUIRKS.values():
            if q.pillar == pillar:
                lines.append(f"- {q.id} ({q.plain_name}): {q.description}")
    return "\n".join(lines) + "\n"


def tally(uploads: Iterable[tuple[str, dict[str, str], dict[str, tuple[str, Optional[str]]]]]) -> list[dict]:
    """Per-pillar totals over time from (gradedAt, pillar statuses, check statuses), one
    triple per upload. Every pillar is listed, with every one of its checks."""
    rows = {p: dict(pillar=p, quirks=0, antiquirks=0, neutral=0, firstQuirkAt=None, lastStatus=None,
                    lastAt=None, checks={c.id: dict(checkId=c.id, met=0, missed=0)
                                         for c in QUIRKS.values() if c.pillar == p})
            for p in PILLARS}
    for graded_at, pillars, checks in sorted(uploads, key=lambda u: u[0]):
        for p, status in pillars.items():
            r = rows[p]
            if status == QUIRK:
                r["quirks"] += 1
                r["firstQuirkAt"] = r["firstQuirkAt"] or graded_at
            elif status == ANTIQUIRK:
                r["antiquirks"] += 1
            elif status == NEUTRAL:
                r["neutral"] += 1
            if status != NOT_SHOWN:
                r["lastStatus"], r["lastAt"] = status, graded_at
        for cid, (status, _) in checks.items():
            r = rows[QUIRKS[cid].pillar]["checks"][cid]
            if status == MET:
                r["met"] += 1
            elif status == MISSED:
                r["missed"] += 1
    return [{**r, "checks": list(r["checks"].values())} for r in rows.values()]


def upload_summary(questions: Sequence["QuestionGradingOutput"]) -> tuple[dict[str, str], dict[str, tuple[str, Optional[str]]]]:
    return upload_pillar_statuses(questions), upload_check_statuses(questions)


def _check() -> None:
    """Every `opposes` entry names a real error code (run by the tests)."""
    for q in QUIRKS.values():
        for code in q.opposes:
            if code not in CODES:
                raise ValueError(f"{q.id} opposes unknown code {code}")
