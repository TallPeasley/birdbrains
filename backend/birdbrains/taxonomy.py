"""Six-Pillar Taxonomy and Curriculum Registry.

This text is what gets placed in the 24-hour Gemini context cache. The error codes
themselves live in ``error_codes.json`` (loaded by ``codes.py``), which the site
imports too, so the backend and the site can never drift apart. Maalik approved the
six pillars on 2026-11-25 and readable ids with fuller detail on 2026-11-26.
"""
from __future__ import annotations

from .codes import CODES, LEGACY_CODES, ErrorCode, current_code  # noqa: F401  (re-exported)
from .schemas import CourseEnum

PILLAR_NAMES = {
    "CON": "Concepts",
    "STR": "Strategy & Setup",
    "PRC": "Procedure",
    "FAC": "Calculation & Recall",
    "COM": "Communication",
    "TST": "Test Habits",
}

PILLAR_SCOPES = {
    "CON": "The student holds a wrong idea about the mathematics itself.",
    "STR": "The ideas are sound, but the plan is wrong: the wrong method or formula, "
           "or the question turned into the wrong equation.",
    "PRC": "The plan is right, but carrying out the method goes wrong.",
    "FAC": "Method and plan are sound; a number, fact, formula, unit or rounding slips.",
    "COM": "The maths may be right, but the answer does not say what was asked, "
           "or the work cannot be followed.",
    "TST": "How the student handles the test: blanks, skipped parts, traps, giving up, "
           "not checking, guessing.",
}

# Points per pillar on one question (sum 10). Deductions are for root causes only.
PILLAR_MAX_SCORES = {"CON": 2, "STR": 2, "PRC": 2, "FAC": 2, "COM": 1, "TST": 1}

# code -> (name, description, remediation). Kept for callers that index by code.
ERROR_CODES: dict[str, tuple[str, str, str]] = {
    c.id: (c.name, c.description, c.remediation) for c in CODES.values()
}


def pillar_of(code: str) -> str:
    return current_code(code)[:3]


def _code_text(c: ErrorCode) -> list[str]:
    lines = [f"- {c.id} ({c.name}): {c.description}", f"  Example: {c.example}"]
    for t in c.tell_apart:
        lines.append(f"  Not this: {t.how} -> {t.code}." if t.code else f"  Not this: {t.how}.")
    lines.append(f"  Remediation: {c.remediation}")
    return lines


def _taxonomy_text() -> str:
    lines = [
        "# Six-Pillar Error Taxonomy",
        "",
        f"Every root-cause error is assigned exactly one pillar and exactly one of the {len(CODES)}",
        "error codes below. The code's first three letters ARE its pillar. Never invent a",
        "code outside this list. When two codes seem to fit, follow the 'Not this' lines.",
        "",
        "To choose the pillar, ask in order: Is the student's idea of the maths wrong",
        "(CON)? Is the idea right but the plan or setup wrong (STR)? Is the plan right but",
        "the method carried out wrongly (PRC)? Is it a slip in a number, fact, formula,",
        "unit or rounding (FAC)? Is the maths right but the answer not what was asked,",
        "unjustified or unreadable (COM)? Or is it how the test was handled: blank,",
        "skipped, trap, abandoned, unchecked, guessed (TST)?",
    ]
    for pillar, title in PILLAR_NAMES.items():
        lines += ["", f"## {pillar}: {title}", PILLAR_SCOPES[pillar]]
        for c in CODES.values():
            if c.pillar == pillar:
                lines += _code_text(c)
    lines += [
        "",
        "## Carry-forward protection",
        "If an error in step N makes step N+1 wrong even though step N+1 applies valid",
        "logic to step N's result, step N+1 is a cascading consequence",
        "(is_cascading_consequence = true). It is never penalised and never counted as a",
        "new root cause. Credit the reasoning the student showed on that line.",
    ]
    return "\n".join(lines) + "\n"


SIX_PILLAR_TAXONOMY = _taxonomy_text()
FOUR_PILLAR_TAXONOMY = SIX_PILLAR_TAXONOMY  # old name, kept for imports

# course -> strand -> units. Strand names follow the Ontario curriculum
# (MTH1W, 2021; MPM2D, 2005 revised).
CURRICULUM: dict[CourseEnum, dict[str, list[str]]] = {
    CourseEnum.MTH1W: {
        "Number": ["Number Sense", "Powers", "Rational Numbers", "Proportional Reasoning"],
        "Algebra": ["Algebra & Linear Relations", "Algebraic Expressions", "Linear Relations", "Coding"],
        "Data": ["Data", "Data Collection and Analysis", "Mathematical Modelling"],
        "Geometry and Measurement": ["Geometry & Measurement", "Geometric Relationships", "Measurement"],
        "Financial Literacy": ["Financial Literacy", "Financial Decisions"],
    },
    CourseEnum.MPM2D: {
        "Quadratic Relations": [
            "Quadratic Relations",
            "Completing the Square",
            "Factoring",
            "Solving Quadratic Equations",
        ],
        "Analytic Geometry": ["Linear Systems", "Analytic Geometry", "Properties of Line Segments"],
        "Trigonometry": ["Trigonometry", "Similar Triangles", "Sine and Cosine Laws"],
    },
}


def strand_for(course: CourseEnum, unit_topic: str) -> str:
    """Map a free-text unit/topic tag to a curriculum strand."""
    text = unit_topic.lower()
    strands = CURRICULUM[course]
    for strand, units in strands.items():
        if any(u.lower() in text for u in units) or strand.lower() in text:
            return strand
    return "Other"


def curriculum_registry_text() -> str:
    lines = ["# Curriculum Registry (Ontario)"]
    for course, strands in CURRICULUM.items():
        grade = "Grade 9 de-streamed" if course is CourseEnum.MTH1W else "Grade 10 academic"
        lines.append(f"\n## {course.value} ({grade})")
        for strand, units in strands.items():
            lines.append(f"- Strand: {strand}. Units: {', '.join(units)}.")
    return "\n".join(lines)


def cached_context_text() -> str:
    from .quirks import quirks_text

    return SIX_PILLAR_TAXONOMY + "\n" + quirks_text() + "\n" + curriculum_registry_text()
