"""Six-Pillar Taxonomy and Curriculum Registry.

This text is what gets placed in the 24-hour Gemini context cache. The 24 error
codes grew out of the 16 in the Freelancer Specification and Pipeline Manual,
section 2.1 (Maalik approved six pillars on 2026-11-25). Keep
``lib/errorCodes.ts`` and ``components/student/errorCodeHelp.ts`` in the
frontend in step with ``ERROR_CODES`` below.

Code ids are stable: a code that stayed in its pillar kept its id, and the ids of
codes that moved pillar (CON-02, CON-03, TST-01, TST-02) are retired, never
reused. ``LEGACY_CODES`` maps them to their new ids so gradings stored before the
change still load and count under the right pillar.
"""
from __future__ import annotations

from .schemas import LEGACY_CODES, CourseEnum

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
    "FAC": "Method and plan are sound; a number, fact, unit or rounding slips.",
    "COM": "The maths may be right, but the answer does not say what was asked, "
           "or the work cannot be followed.",
    "TST": "How the student handles the test: blanks, traps, giving up, not checking.",
}

# Points per pillar on one question (sum 10). Deductions are for root causes only.
PILLAR_MAX_SCORES = {"CON": 2, "STR": 2, "PRC": 2, "FAC": 2, "COM": 1, "TST": 1}

# code -> (short name, what it means, remediation trigger)
ERROR_CODES: dict[str, tuple[str, str, str]] = {
    "CON-01": ("Foundational Misconception",
               "Flawed mental model of a quantity or operation (e.g. adding denominators directly).",
               "Tier 1: concrete visual or area diagram."),
    "CON-04": ("Sign / Direction Misconception",
               "Misunderstands what a sign, direction or coordinate frame means "
               "(e.g. reads a negative slope as rising).",
               "Tier 1: reference frame sketch."),
    "CON-05": ("Overgeneralised Rule",
               "Uses a rule beyond where it holds, e.g. (a+b)^2 = a^2 + b^2, "
               "sqrt(a+b) = sqrt(a) + sqrt(b), cancelling terms instead of factors.",
               "Tier 1: counterexample check with numbers."),
    "CON-06": ("Domain / Restriction Blindness",
               "Ignores where an expression is defined: divides by zero or by a "
               "variable that may be zero, takes the root of a negative, keeps an "
               "impossible length or angle.",
               "Tier 1: 'what values are allowed?' check."),
    "STR-01": ("Formula / Law Misselection",
               "Applies a theorem or formula that is not valid for the problem's "
               "conditions (e.g. sine law where cosine law is needed).",
               "Tier 1: boundary discrimination comparison."),
    "STR-02": ("Setup / Representation Error",
               "Mismaps word-problem constraints, a diagram or a graph to the equation "
               "or puts given values in the wrong places.",
               "Tier 1: dimensional analysis table."),
    "STR-03": ("No Viable Plan",
               "Starts with a move that cannot lead to the answer, or moves around "
               "without a plan (e.g. tries to isolate x in a quadratic by square-rooting "
               "only one term).",
               "Tier 2: plan-first prompt (name the method before writing)."),
    "STR-04": ("Unsuitable Method",
               "A valid path, but one that does not fit: the prompt asked for a "
               "particular method, or the chosen method makes the work far longer and "
               "error-prone than needed.",
               "Tier 2: method comparison side by side."),
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
               "Miscopies a digit or sign between consecutive lines or from the question.",
               "Tier 3: given-data check habit."),
    "FAC-03": ("Unit Conversion / Constant Recall",
               "Unit conversion slip or misremembered constant or formula value.",
               "Tier 3: dimensional conversion bridge."),
    "FAC-04": ("Rounding / Significant Figures",
               "Rounds too early or breaks a precision rule.",
               "Tier 3: precision constraint rules."),
    "COM-01": ("Prompt Constraint Misread",
               "Answers a different target than asked (solves for x instead of 2x+5, "
               "gives one root when both are asked for).",
               "Tier 4: pre-submission prompt deconstruction box."),
    "COM-02": ("Missing Units / Concluding Statement",
               "Omits final units or the required concluding statement.",
               "Tier 4: concluding statement and unit slot."),
    "COM-03": ("Notation / Layout Misuse",
               "Misuses mathematical notation or lays work out so it cannot be followed: "
               "run-on equals chains, missing brackets, equals signs between unequal "
               "things, illegible lines.",
               "Tier 4: one-equation-per-line layout model; ask for a clearer retake "
               "if the page is hard to read."),
    "COM-04": ("Unsupported Answer",
               "Gives an answer, claim or 'show that' conclusion with the reasoning or "
               "justification the question requires missing.",
               "Tier 4: 'because ...' justification frame."),
    "TST-03": ("Unanswered / Time-Attrition Blank",
               "Leaves a question blank from time pressure or a frustration block.",
               "Prerequisite baseline probe."),
    "TST-04": ("Distractor Trap",
               "Takes an intermediate value or a tempting wrong option as the final "
               "answer.",
               "Tier 4: 'is this what was asked?' stop sign."),
    "TST-05": ("Abandoned Work",
               "Starts a valid approach, then stops or crosses it out partway with no "
               "answer.",
               "Tier 2: first-step confidence warm-up, then the same problem."),
    "TST-06": ("Unchecked Unreasonable Answer",
               "Gives an answer that a quick check would show is impossible or absurd "
               "(a negative length, a probability over 1, a root that does not satisfy "
               "the equation) and does not notice.",
               "Tier 4: substitute-back / estimate check habit."),
}

# Retired ids (from the four-pillar list) -> their id in the six-pillar list.
# Defined in schemas (which taxonomy imports) so stored gradings upgrade on load.
assert all(new in ERROR_CODES for new in LEGACY_CODES.values())

PILLAR_CODES = tuple(PILLAR_NAMES)


def current_code(code: str | None) -> str | None:
    """The six-pillar id for ``code`` (old ids are remapped; others pass through)."""
    if code is None:
        return None
    return LEGACY_CODES.get(code, code)


def pillar_of(code: str) -> str:
    return current_code(code)[:3]


def _taxonomy_text() -> str:
    lines = [
        "# Six-Pillar Error Taxonomy",
        "",
        f"Every root-cause error is assigned exactly one pillar and exactly one of the {len(ERROR_CODES)}",
        "error codes below. The code's three-letter prefix IS its pillar. Never invent a",
        "code outside this list.",
        "",
        "To choose the pillar, ask in order: Is the student's idea of the maths wrong",
        "(CON)? Is the idea right but the plan or setup wrong (STR)? Is the plan right but",
        "the method carried out wrongly (PRC)? Is it a slip in a number, fact, unit or",
        "rounding (FAC)? Is the maths right but the answer not what was asked, unjustified",
        "or unreadable (COM)? Or is it how the test was handled: blank, trap, abandoned,",
        "unchecked (TST)?",
    ]
    for pillar, title in PILLAR_NAMES.items():
        lines += ["", f"## {pillar}: {title}", PILLAR_SCOPES[pillar]]
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
    return SIX_PILLAR_TAXONOMY + "\n" + curriculum_registry_text()
