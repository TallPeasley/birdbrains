"""Curriculums, grades, subjects and the shared K-12 topic catalog.

Two kinds of data live next to this module:

* ``curricula.json``: every curriculum Quark knows (Ontario, BC, Alberta, Quebec, other
  Canadian provinces, US Common Core, NGSS, other US states, England's National
  Curriculum, IB, AP, other). Each curriculum lists its grades, and each grade has an
  age-equivalent ``level`` (0 = kindergarten, 12 = final year of school). The site
  imports the same file for its curriculum picker.
* ``topics/<subject>.json``: one catalog per subject (math, biology, chemistry, physics,
  earth_science). Topics are curriculum-agnostic: each has the grade levels it is
  usually taught at, a strand, learning goals, key concepts, prerequisites, common
  misconceptions (each mapped to an error code the grader already knows) and example
  problems with answers.

A **course id** says what a student is studying. It is either a legacy Ontario course
code (``MTH1W``, ``MPM2D``, kept exactly as before so stored data still loads) or
``<curriculum>.<grade>.<subject>``, for example ``ccss.g7.math`` or ``eng.y10.physics``.

A course's topics are the catalog topics for its subject whose level range includes the
course's level. Grade placement in the catalog is a typical North American placement and
is marked ``needs_review``; it is not a claim about any curriculum's official standards.

This module must not import ``schemas`` (``schemas`` imports it).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

_DIR = Path(__file__).parent
CATALOG_SUBJECTS = ("math", "biology", "chemistry", "physics", "earth_science")


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


REGISTRY: dict = _load(_DIR / "curricula.json")
CURRICULA: dict[str, dict] = {c["id"]: c for c in REGISTRY["curricula"]}
SUBJECTS: dict[str, dict] = {s["id"]: s for s in REGISTRY["subjects"]}
LEGACY_COURSES: dict[str, dict] = {c["id"]: c for c in REGISTRY["legacy_courses"]}
GRADABLE_SUBJECTS: frozenset[str] = frozenset(REGISTRY["gradable_subjects"])


@lru_cache(maxsize=None)
def catalog(subject: str) -> dict:
    """The topic catalog for one catalog subject (not 'science', which spans four)."""
    if subject not in CATALOG_SUBJECTS:
        raise KeyError(f"no topic catalog for subject {subject!r}")
    return _load(_DIR / "topics" / f"{subject}.json")


@lru_cache(maxsize=None)
def all_topics() -> dict[str, dict]:
    """Every topic in every catalog, by id. Each topic dict gains a 'subject' key."""
    out: dict[str, dict] = {}
    for subject in CATALOG_SUBJECTS:
        for t in catalog(subject)["topics"]:
            out[t["id"]] = {**t, "subject": subject}
    return out


def catalog_subjects(subject: str) -> tuple[str, ...]:
    """The catalog subjects a picker subject covers ('science' -> the four sciences)."""
    return tuple(SUBJECTS[subject].get("covers", [subject]))


@dataclass(frozen=True)
class Course:
    id: str
    curriculum: str
    grade: str
    subject: str
    level: int
    label: str  # short, for chips and selects: "Grade 7 · Math"
    name: str  # long: "Grade 7 Math · US Common Core (math)"
    legacy: bool = False

    @property
    def gradable(self) -> bool:
        return self.subject in GRADABLE_SUBJECTS

    @property
    def is_ontario(self) -> bool:
        return self.curriculum == "on"


def _grade(curriculum: str, grade_id: str) -> Optional[dict]:
    c = CURRICULA.get(curriculum)
    if not c:
        return None
    return next((g for g in c["grades"] if g["id"] == grade_id), None)


def grade_subjects(curriculum: str, grade_id: str) -> list[str]:
    """Subjects offered for a curriculum and grade: those the grade allows that have
    at least one catalog topic at its level, in registry order."""
    g = _grade(curriculum, grade_id)
    if not g:
        return []
    allowed = g.get("subjects") or [s["id"] for s in REGISTRY["subjects"]]
    return [s for s in SUBJECTS if s in allowed and _topics_at(s, g["level"])]


def _topics_at(subject: str, level: int) -> list[dict]:
    return [t for t in all_topics().values()
            if t["subject"] in catalog_subjects(subject) and t["levels"][0] <= level <= t["levels"][1]]


_COURSE_RE = re.compile(r"^([a-z_]+)\.([a-z0-9_]+)\.([a-z_]+)$")


def new_course_id(curriculum: str, grade_id: str, subject: str) -> str:
    """The course id for a picker choice. Ontario Grade 9/10 math keep their legacy codes."""
    for legacy in LEGACY_COURSES.values():
        if (legacy["curriculum"], legacy["grade"], legacy["subject"]) == (curriculum, grade_id, subject):
            return legacy["id"]
    return f"{curriculum}.{grade_id}.{subject}"


@lru_cache(maxsize=4096)
def parse_course(course_id: str) -> Course:
    """Resolve a course id. Raises ValueError for anything unknown."""
    if course_id in LEGACY_COURSES:
        lc = LEGACY_COURSES[course_id]
        g = _grade(lc["curriculum"], lc["grade"])
        return Course(course_id, lc["curriculum"], lc["grade"], lc["subject"], g["level"], lc["label"],
                      f"{lc['name']} · {CURRICULA[lc['curriculum']]['name']}", legacy=True)
    m = _COURSE_RE.match(course_id or "")
    if not m:
        raise ValueError(f"unknown course {course_id!r}")
    curriculum, grade_id, subject = m.groups()
    g = _grade(curriculum, grade_id)
    if g is None or subject not in grade_subjects(curriculum, grade_id):
        raise ValueError(f"unknown course {course_id!r}")
    if new_course_id(curriculum, grade_id, subject) != course_id:
        # Ontario Grade 9/10 math must use MTH1W / MPM2D, so one course never has two ids.
        raise ValueError(f"use {new_course_id(curriculum, grade_id, subject)!r} for {course_id!r}")
    sname = SUBJECTS[subject]["name"]
    return Course(course_id, curriculum, grade_id, subject, g["level"], f"{g['label']} · {sname}",
                  f"{g['label']} {sname} · {CURRICULA[curriculum]['name']}")


def is_valid_course(course_id: str) -> bool:
    try:
        parse_course(course_id)
        return True
    except ValueError:
        return False


def topics_for(course_id: str) -> list[dict]:
    c = parse_course(course_id)
    return _topics_at(c.subject, c.level)


_STOP = frozenset("a an and the of to in on for with by its their from at as".split())


def _tokens(text: str) -> list[str]:
    words = re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
    # Light stemming so "equations" matches "equation" and "factoring" matches "factor".
    out = []
    for w in words:
        if w in _STOP:
            continue
        for suffix in ("ing", "es", "s"):
            if len(w) > 4 and w.endswith(suffix):
                w = w[: -len(suffix)]
                break
        out.append(w)
    return out


def match_topic(course_id: str, unit_topic: str) -> Optional[dict]:
    """The course topic a free-text unit/topic tag is about, or None.

    Each topic name and alias is scored by the share of its words found in the tag;
    at least 60% must match. Ties go to the longer phrase, so 'Equations of lines'
    beats 'Lines'."""
    text = set(_tokens(unit_topic or ""))
    if not text:
        return None
    best, best_key = None, (0.0, 0)
    for t in topics_for(course_id):
        for phrase in [t["name"], *t.get("aliases", [])]:
            words = _tokens(phrase)
            if not words:
                continue
            score = sum(w in text for w in words) / len(words)
            key = (score, len(words))
            if score >= 0.6 and key > best_key:
                best, best_key = t, key
    return best


def strand_for(course_id: str, unit_topic: str) -> str:
    t = match_topic(course_id, unit_topic)
    return t["strand"] if t else "Other"


def unit_names(course_id: str) -> list[str]:
    """Topic names for a course, for Stage 1 to copy into ``detected_unit``."""
    return [t["name"] for t in topics_for(course_id)]


def course_context_text(course_id: str, unit_topic: str = "") -> str:
    """Prompt text describing the student's course, and the matching topic's goals and
    common misconceptions (with the codes they usually map to) when one matches."""
    c = parse_course(course_id)
    cur = CURRICULA[c.curriculum]
    lines = [
        f"Curriculum: {cur['name']}. Grade: {_grade(c.curriculum, c.grade)['label']} "
        f"(about grade level {c.level}, where 0 is kindergarten). Subject: {SUBJECTS[c.subject]['name']}.",
        "Pitch the answer key and wording to this level. Grade placement varies by curriculum; never "
        "mark work wrong only because it uses a method from a different grade or curriculum.",
    ]
    t = match_topic(course_id, unit_topic)
    if t:
        lines.append(f"Topic: {t['name']} (strand: {t['strand']}).")
        lines.append("Learning goals: " + " ".join(t["learning_goals"]))
        if t["misconceptions"]:
            lines.append("Common misconceptions for this topic (use the code only if the work shows it):")
            for m in t["misconceptions"]:
                lines.append(f"- {m['description']} e.g. {m['example']} -> {m['error_code']}")
    return "\n".join(lines)


# ---------------------------------------------------------------- validation
def validate() -> list[str]:
    """Problems with the registry or catalogs (empty when everything is consistent).
    Run by backend/tests/test_curricula.py."""
    from ..codes import CODES as MATH_CODES
    from ..subjects import codes_by_id

    problems: list[str] = []
    code_sets = {"math": set(MATH_CODES)}
    for s in ("biology", "chemistry", "physics"):
        code_sets[s] = set(codes_by_id(s))

    seen: set[str] = set()
    for c in REGISTRY["curricula"]:
        if c["id"] in seen:
            problems.append(f"duplicate curriculum {c['id']}")
        seen.add(c["id"])
        gids = [g["id"] for g in c["grades"]]
        if len(gids) != len(set(gids)):
            problems.append(f"{c['id']}: duplicate grade ids")
        for g in c["grades"]:
            if not 0 <= g["level"] <= 12:
                problems.append(f"{c['id']}.{g['id']}: level {g['level']} out of range")
            for s in g.get("subjects", []):
                if s not in SUBJECTS:
                    problems.append(f"{c['id']}.{g['id']}: unknown subject {s}")
            if not grade_subjects(c["id"], g["id"]):
                problems.append(f"{c['id']}.{g['id']}: no subject has topics at this level")
    for lc in LEGACY_COURSES.values():
        if _grade(lc["curriculum"], lc["grade"]) is None:
            problems.append(f"legacy course {lc['id']} points at a missing grade")

    topics = all_topics()
    for subject in CATALOG_SUBJECTS:
        ids = [t["id"] for t in catalog(subject)["topics"]]
        if len(ids) != len(set(ids)):
            problems.append(f"{subject}: duplicate topic ids")
    for t in topics.values():
        where = t["id"]
        lo, hi = t["levels"]
        if not (0 <= lo <= hi <= 12):
            problems.append(f"{where}: bad levels {t['levels']}")
        for key in ("learning_goals", "key_concepts", "misconceptions", "example_problems"):
            if not t.get(key):
                problems.append(f"{where}: no {key}")
        for p in t["prerequisites"]:
            if p not in topics:
                problems.append(f"{where}: unknown prerequisite {p}")
            elif topics[p]["levels"][0] > lo:
                problems.append(f"{where}: prerequisite {p} starts later ({topics[p]['levels'][0]} > {lo})")
        for m in t["misconceptions"]:
            tax = m.get("taxonomy") or catalog(t["subject"]).get("taxonomy") or (
                "math" if t["subject"] == "math" else None)
            if tax not in code_sets:
                problems.append(f"{where}: misconception has no taxonomy")
            elif m["error_code"] not in code_sets[tax]:
                problems.append(f"{where}: {m['error_code']} is not a {tax} code")
        for ex in t["example_problems"]:
            if not ex.get("prompt") or not ex.get("answer"):
                problems.append(f"{where}: example problem without prompt or answer")
    # Prerequisite cycles.
    state: dict[str, int] = {}

    def visit(tid: str, path: tuple[str, ...]) -> None:
        if state.get(tid) == 2:
            return
        if state.get(tid) == 1:
            problems.append("prerequisite cycle: " + " -> ".join(path + (tid,)))
            return
        state[tid] = 1
        for p in topics[tid]["prerequisites"]:
            if p in topics:
                visit(p, path + (tid,))
        state[tid] = 2

    for tid in topics:
        visit(tid, ())
    return problems
