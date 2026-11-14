"""Four-Pillar Taxonomy and Curriculum Registry.

This text is what gets placed in the 24-hour Gemini context cache. The 16 error
codes are the official list from the Freelancer Specification and Pipeline
Manual, section 2.1. Keep ``lib/errorCodes.ts`` in the frontend in step with
``ERROR_CODES`` below.
"""
from __future__ import annotations

from .schemas import CourseEnum

PILLAR_NAMES = {
    "CON": "Conceptual Errors",
    "PRC": "Procedural Errors",
    "FAC": "Factual & Calculation Fluency",
    "TST": "Test-Taking & Communication Habits",
}

# code -> (short name, what it means, remediation trigger)
ERROR_CODES: dict[str, tuple[str, str, str]] = {
    "CON-01": ("Foundational Misconception",
               "Flawed mental model (e.g. adding denominators directly).",
               "Tier 1: concrete visual or area diagram."),
    "CON-02": ("Formula/Law Misselection",
               "Applies a theorem or formula that is not valid for the problem's conditions.",
               "Tier 1: boundary discrimination comparison."),
    "CON-03": ("Representation / Variable Confusion",
               "Mismaps word-problem constraints or a graph to the equation.",
               "Tier 1: dimensional analysis table."),
    "CON-04": ("Sign / Vector Direction Misconception",
               "Misassigns a coordinate frame, direction or the meaning of a sign.",
               "Tier 1: reference frame sketch."),
    "PRC-01": ("Algorithmic Step Omission",
               "Skips a mandatory step of the procedure.",
               "Tier 2: faded worked example (80% completed)."),
    "PRC-02": ("Order of Operations / Sequencing",
               "Applies valid rules in an invalid order.",
               "Tier 2: Parsons problem (reorder the steps)."),
    "PRC-03": ("Algebraic Manipulation / Sign Failure",
               "Drops a sign or factor while distributing, or fails to flip an inequality.",
               "Tier 2: sign-tracking highlight checkpoints."),
    "PRC-04": ("Incomplete Simplification",
               "Stops before reaching the simplified or requested form.",
               "Tier 2: completion checklist."),
    "FAC-01": ("Basic Arithmetic / Math Fact Slip",
               "Isolated arithmetic error with a sound procedure.",
               "Tier 3: 5-item rapid micro-drill."),
    "FAC-02": ("Transcription / Copy Error",
               "Miscopies a digit or sign between consecutive lines.",
               "Tier 3: given-data check habit."),
    "FAC-03": ("Unit Conversion / Constant Recall",
               "Unit conversion slip or misremembered constant or formula value.",
               "Tier 3: dimensional conversion bridge."),
    "FAC-04": ("Rounding / Significant Figures",
               "Rounds too early or breaks a precision rule.",
               "Tier 3: precision constraint rules."),
    "TST-01": ("Prompt Constraint Misread",
               "Answers a different target than asked (solves for x instead of 2x+5).",
               "Tier 4: pre-submission prompt deconstruction box."),
    "TST-02": ("Missing Units / Communication Gap",
               "Omits final units or the required concluding statement.",
               "Tier 4: concluding statement and unit slot."),
    "TST-03": ("Unanswered / Time-Attrition Blank",
               "Leaves a question blank from time pressure or a frustration block.",
               "Prerequisite baseline probe."),
    "TST-04": ("Distractor Trap / Illegible Work",
               "Falls for an intermediate-value trap or misreads own handwriting.",
               "Grid workspace; ask for a clearer retake if the page is hard to read."),
}


def _taxonomy_text() -> str:
    lines = [
        "# BirdBrains Four-Pillar Error Taxonomy",
        "",
        "Every root-cause error is assigned exactly one pillar and exactly one of the 16",
        "error codes below. Never invent a code outside this list.",
    ]
    for pillar, title in PILLAR_NAMES.items():
        lines += ["", f"## {pillar}: {title}"]
        for code, (name, meaning, trigger) in ERROR_CODES.items():
            if code.startswith(pillar):
                lines.append(f"- {code} {name}: {meaning} Remediation: {trigger}")
    lines += [
        "",
        "## Carry-forward protection",
        "If an error in step N makes step N+1 wrong even though step N+1 applies valid",
        "logic to step N's result, step N+1 is a cascading consequence",
        "(is_cascading_consequence = true). It is never penalised and never counted as a",
        "new root cause. Credit the reasoning the student showed on that line.",
    ]
    return "\n".join(lines) + "\n"


FOUR_PILLAR_TAXONOMY = _taxonomy_text()

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
    return FOUR_PILLAR_TAXONOMY + "\n" + curriculum_registry_text()
