"""Four-Pillar Taxonomy and Curriculum Registry.

This text is what gets placed in the 24-hour Gemini context cache. The error-code
registry is a first draft: edit the codes here and every stage picks them up.
"""
from __future__ import annotations

from .schemas import CourseEnum

FOUR_PILLAR_TAXONOMY = """\
# BirdBrains Four-Pillar Error Taxonomy

Every root-cause error is assigned exactly one pillar and one error code of the
form PILLAR-NN.

## CON: Conceptual Errors
The student misunderstands what a mathematical object is or why a method works.
- CON-01 Misreads the structure of an expression or equation (e.g. treats a quadratic as linear).
- CON-02 Breaks equation equivalence (does something to one side only).
- CON-03 Chooses a method that does not fit the problem type.
- CON-04 Misinterprets what the answer represents (vertex vs. intercept, slope vs. rate).
- CON-05 Confuses related concepts (area/perimeter, sine/cosine ratio, expand/factor).
- CON-06 Misapplies a property outside its domain (e.g. distributes an exponent over a sum).

## PRC: Procedural Errors
The student knows the idea but executes the algorithm's steps incorrectly.
- PRC-01 Fails to distribute a factor to every term (including terms leaving a bracket).
- PRC-02 Skips or reorders a required step of a standard algorithm.
- PRC-03 Sign error while moving, distributing or collecting terms.
- PRC-04 Incorrect factoring or expanding procedure.
- PRC-05 Incorrect isolation of a variable (inverse operations out of order).
- PRC-06 Substitution carried out incorrectly.

## FAC: Factual & Calculation Fluency
A recall or arithmetic slip, not a gap in method.
- FAC-01 Basic arithmetic error with integers.
- FAC-02 Fraction or decimal arithmetic error.
- FAC-03 Misremembered formula or constant.
- FAC-04 Exponent or square-root fact error.
- FAC-05 Transcription error: copies a number or sign wrongly between lines.

## TST: Test-Taking & Communication Habits
The mathematics may be sound, but the way the work is done or presented loses marks.
- TST-01 Final answer not stated, or not in the requested form.
- TST-02 Missing units, labels or a concluding statement.
- TST-03 Steps skipped so reasoning cannot be followed.
- TST-04 Did not answer the question that was asked, or answered only part.
- TST-05 Work abandoned or left incomplete.
- TST-06 Notation misuse (dangling equals signs, missing brackets) that obscures meaning.

## Carry-forward protection
When a line is wrong only because it correctly continues from an earlier error, it
is a cascading consequence. It is never penalised and never counted as a new root
cause. Credit the reasoning the student showed on that line.
"""

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
