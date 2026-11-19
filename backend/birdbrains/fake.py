"""Deterministic stand-ins for Gemini, used for local runs and tests so the whole
backend works without a cloud project. Output is the spec's completing-the-square
example regardless of the photo."""
from __future__ import annotations

from typing import Optional, Sequence

from .batch_engine import FlaggedGrading
from .pipeline import ImageRef, Meter, SubmissionContext, aggregate_question_gradings
from .schemas import (
    QuestionGradingOutput,
    Stage1TranscriptionOutput,
    Stage2GradingAndAffectOutput,
    WorksheetContent,
)

_PROBLEM = "Convert y = 2x^2 + 12x + 5 to vertex form and state the vertex."

_LINES = [
    ("y = 2x^2 + 12x + 5", ["CLEAN_CONTINUOUS_FLOW"]),
    ("y = 2(x^2 + 6x) + 5", ["CLEAN_CONTINUOUS_FLOW"]),
    ("y = 2(x^2 + 6x + 9 - 9) + 5", ["REPEATED_REWRITES"]),
    ("y = 2(x + 3)^2 - 9 + 5", ["HEAVY_SCRATCHOUT_DENSITY"]),
    ("y = 2(x + 3)^2 - 4", ["HEAVY_SCRATCHOUT_DENSITY", "MARGIN_QUESTION_MARKS"]),
]


class FakePipeline:
    def run_stage1(self, ctx: SubmissionContext, images: Sequence[ImageRef],
                   meter: Optional[Meter] = None) -> Stage1TranscriptionOutput:
        import time

        if meter is not None:
            meter.record("stage1", "fake", time.monotonic())
        n = len(_LINES)
        line_dicts = [
            {
                "line_number": i + 1,
                "raw_latex": latex,
                "bounding_box_normalized": [0.08, i / n, 0.92, (i + 1) / n],
                "confidence_score": 0.94,
                "visual_affect_markers": markers,
            }
            for i, (latex, markers) in enumerate(_LINES)
        ]
        return Stage1TranscriptionOutput.model_validate(
            {
                "submission_id": ctx.submission_id,
                "overall_ocr_confidence": 0.94,
                "questions": [
                    {
                        "question_number": "1",
                        "problem_statement": _PROBLEM,
                        "lines": line_dicts,
                    }
                ],
                "lines": line_dicts,
                "requires_hitl": False,
            }
        )

    def run_stage2(self, ctx: SubmissionContext, stage1: Stage1TranscriptionOutput, plan: str = "pro",
                   meter: Optional[Meter] = None) -> Stage2GradingAndAffectOutput:
        import time

        if meter is not None:
            meter.record("stage2", "fake", time.monotonic())
        free = plan == "free"
        questions = stage1.resolved_questions()
        q0 = questions[0] if questions else None
        q_lines = q0.lines if q0 and q0.lines else stage1.lines

        def latex_at(n: int) -> str:
            if 1 <= n <= len(q_lines):
                return q_lines[n - 1].raw_latex
            return _LINES[n - 1][0]

        def step(n, ok, cf, pillar, code, why):
            return {
                "step_number": n,
                "student_latex": latex_at(n),
                "is_correct": ok,
                "is_carry_forward_consistent": cf,
                "pillar": pillar,
                "error_code": code,
                "explanation": why,
            }

        q_out = QuestionGradingOutput.model_validate(
            {
                "question_number": q0.question_number if q0 else "1",
                "problem_statement": (q0.problem_statement if q0 and q0.problem_statement else _PROBLEM),
                "answer_key": {
                    "method_used": "Completing the square",
                    "steps": [
                        {
                            "step_number": 1,
                            "description": "Factor the leading coefficient 2 from the x^2 and x terms.",
                            "expected_math": "y = 2(x^2 + 6x) + 5",
                            "is_key_step": True,
                        },
                        {
                            "step_number": 2,
                            "description": "Complete the square inside the bracket by adding and subtracting (6/2)^2 = 9.",
                            "expected_math": "y = 2(x^2 + 6x + 9 - 9) + 5",
                            "is_key_step": True,
                        },
                        {
                            "step_number": 3,
                            "description": "Remove -9 from the bracket and multiply it by the leading coefficient 2.",
                            "expected_math": "y = 2(x + 3)^2 - 18 + 5",
                            "is_key_step": True,
                        },
                        {
                            "step_number": 4,
                            "description": "Combine the constant terms to write the completed vertex form.",
                            "expected_math": "y = 2(x + 3)^2 - 13",
                            "is_key_step": True,
                        },
                        {
                            "step_number": 5,
                            "description": "State the vertex coordinates from vertex form.",
                            "expected_math": "(-3, -13)",
                            "is_key_step": True,
                        },
                    ],
                    "final_answer": "y = 2(x + 3)^2 - 13, vertex (-3, -13)",
                    "answer_verification": (
                        "Expanding 2(x + 3)^2 - 13 = 2(x^2 + 6x + 9) - 13 = 2x^2 + 12x + 18 - 13 = 2x^2 + 12x + 5, "
                        "which matches the original equation."
                    ),
                },
                "final_answer_verification": {
                    "student_final_answer": latex_at(5),
                    "resubstitution_check": (
                        "Expanding the student's final equation gives 2(x + 3)^2 - 4 = 2x^2 + 12x + 18 - 4 = "
                        "2x^2 + 12x + 14, which does not equal the original equation 2x^2 + 12x + 5."
                    ),
                    "satisfies_initial_question": False,
                    "discrepancy_note": (
                        "The expanded constant is 14 instead of 5 because -9 was not multiplied by 2 when leaving "
                        "the bracket in step 4; the vertex point was also omitted."
                    ),
                },
                "key_step_checks": [
                    {
                        "key_step_number": 1,
                        "key_step_description": "Factor 2 from the first two terms.",
                        "expected_math": "y = 2(x^2 + 6x) + 5",
                        "status": "PRESENT",
                        "matched_student_steps": [1, 2],
                        "note": "Accurately copied and factored out 2.",
                    },
                    {
                        "key_step_number": 2,
                        "key_step_description": "Complete the square inside the bracket using +9 - 9.",
                        "expected_math": "y = 2(x^2 + 6x + 9 - 9) + 5",
                        "status": "PRESENT",
                        "matched_student_steps": [3],
                        "note": "Correctly added and subtracted 9 inside the bracket.",
                    },
                    {
                        "key_step_number": 3,
                        "key_step_description": "Multiply -9 by the outer factor 2 when removing it from the bracket.",
                        "expected_math": "y = 2(x + 3)^2 - 18 + 5",
                        "status": "PRESENT_WITH_ERROR",
                        "matched_student_steps": [4],
                        "note": "Removed -9 without multiplying by 2.",
                    },
                    {
                        "key_step_number": 4,
                        "key_step_description": "Combine constants to finish vertex form.",
                        "expected_math": "y = 2(x + 3)^2 - 13",
                        "status": "PRESENT_WITH_ERROR",
                        "matched_student_steps": [5],
                        "note": "Consistent carry-forward combination (-9 + 5 = -4), but off due to step 4.",
                    },
                    {
                        "key_step_number": 5,
                        "key_step_description": "State the vertex coordinates.",
                        "expected_math": "(-3, -13)",
                        "status": "MISSING",
                        "matched_student_steps": [],
                        "note": "Vertex coordinates were not written as a concluding point.",
                    },
                ],
                "step_evaluations": [
                    step(1, True, False, None, None, "Original equation correctly written."),
                    step(2, True, False, None, None, "Factored 2 out of the first two terms accurately."),
                    step(3, True, False, None, None, "Completed the square inside the bracket using (6/2)^2 = 9."),
                    step(4, False, False, "PRC", "PRC-03",
                         "The -9 leaving the bracket was not multiplied by the outer factor of 2. It should be -18."),
                    step(5, True, True, "PRC", "PRC-03",
                         "Carry-forward protection: -9 + 5 = -4 is consistent with step 4, so no marks are lost here."),
                ],
                "identified_errors": [
                    {
                        "pillar": "PRC",
                        "error_code": "PRC-03",
                        "description": "Did not distribute the leading coefficient to the term removed from the bracket.",
                        "target_entity": "distributing a leading coefficient",
                        "is_cascading_consequence": False,
                        "severity": "HIGH",
                    },
                    {
                        "pillar": "PRC",
                        "error_code": "PRC-03",
                        "description": "Final constant is off because of the step 4 slip.",
                        "target_entity": "vertex form constant",
                        "is_cascading_consequence": True,
                        "severity": "LOW",
                    },
                ],
                "sentiment_entities": [] if free else [
                    {"entity_name": "completing the square", "valence_score": 0.4,
                     "friction_intensity": 0.3, "affect_state": "PRODUCTIVE_STRUGGLE"},
                    {"entity_name": "distributing a leading coefficient", "valence_score": -0.6,
                     "friction_intensity": 0.8, "affect_state": "HIGH_FRICTION_FRUSTRATION"},
                ],
                "aggregate_valence": 0.0 if free else -0.3,
                "aggregate_friction": 0.0 if free else 0.6,
                "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
                "pillar_scores": [
                    {"pillar": "CON", "max_score": 3, "earned_score": 3,
                     "feedback": "You clearly understand how vertex form is built."},
                    {"pillar": "PRC", "max_score": 3, "earned_score": 1.5,
                     "feedback": "One slip when taking -9 out of the bracket in step 4."},
                    {"pillar": "FAC", "max_score": 2, "earned_score": 2, "feedback": "Your arithmetic was accurate throughout."},
                    {"pillar": "TST", "max_score": 2, "earned_score": 1.5,
                     "feedback": "State the vertex as a point at the end."},
                ],
                "supportive_framing_message": (
                    "Great persistence! You set up the square correctly and your thinking about vertex form is solid. "
                    "One thing to watch: anything leaving the bracket gets multiplied by the number outside."
                ),
                "parent_insight": (
                    "The ideas are understood; the frustration comes from one repeated multiplication slip. "
                    "Ask them to say the bracket multiplication step out loud before writing it."
                ),
            }
        )
        return aggregate_question_gradings(ctx.submission_id, [q_out], free=free)


def fake_worksheet(item: FlaggedGrading) -> WorksheetContent:
    return WorksheetContent.model_validate(
        {
            "title": "Mastering Leading Coefficients in Completing the Square",
            "target_concept": "Distributing the outer factor when a term leaves the bracket.",
            "diagnostic_mirror": [
                {
                    "original_step_text": "y = 2(x + 3)^2 - 9 + 5",
                    "annotated_correction": "y = 2(x + 3)^2 - (2 * 9) + 5  =>  y = 2(x + 3)^2 - 18 + 5",
                    "key_takeaway": "Any number leaving the bracket must be multiplied by the factor outside.",
                }
            ],
            "faded_scaffolding": [
                {"step_number": 1, "prompt": "Convert y = 3x^2 + 12x + 1 to vertex form.", "scaffolding_type": "GIVEN",
                 "given_content": "Group and factor out 3: y = 3(x^2 + 4x) + 1",
                 "hint": "Check the factoring by redistributing in your head."},
                {"step_number": 2, "prompt": "Complete the square inside the bracket.",
                 "scaffolding_type": "PARTIAL_BLANK", "given_content": "y = 3(x^2 + 4x + [ __ ] - [ __ ]) + 1",
                 "blank_placeholder": "4", "hint": "Half of 4 is 2. Square it."},
                {"step_number": 3, "prompt": "Take the negative term out of the bracket.",
                 "scaffolding_type": "PARTIAL_BLANK", "given_content": "y = 3(x + 2)^2 - (3 * [ __ ]) + 1",
                 "blank_placeholder": "4", "hint": "Multiply the term you remove by 3."},
                {"step_number": 4, "prompt": "Simplify the constants.", "scaffolding_type": "INDEPENDENT",
                 "given_content": "y = 3(x + 2)^2 - 11", "hint": "Combine -12 and +1."},
            ],
            "independent_transfer": {
                "problem_statement": "Convert y = -4x^2 + 24x - 7 into vertex form and state the maximum point.",
                "target_pillar_focus": "PRC",
                "metacognitive_checklist": [
                    "I factored out -4 correctly in the first step.",
                    "I multiplied the value removed from the bracket by -4.",
                    "I checked my vertex by expanding back to standard form.",
                ],
            },
        }
    )


class FakeBatchEngine:
    """Completes instantly: ``collect`` returns a worksheet for every grading."""

    def __init__(self) -> None:
        self._pending: dict[str, list[FlaggedGrading]] = {}

    def submit(self, items: list[FlaggedGrading]) -> Optional[dict]:
        if not items:
            return None
        name = f"fake-batch-{len(self._pending) + 1}"
        self._pending[name] = items
        return {"name": name, "outputPrefix": "", "gradingIds": [i.grading_id for i in items],
                "state": "SUBMITTED", "submittedAt": ""}

    def collect(self, job: dict):
        items = self._pending.pop(job["name"], [])
        return {i.grading_id: fake_worksheet(i) for i in items}, []
