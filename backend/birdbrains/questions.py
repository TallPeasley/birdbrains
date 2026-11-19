"""Split a graded page into its questions.

A photo often holds more than one question (a linear system, then a triangle). The
models are asked to tag each line with its question, but this check does not rely on
that alone: it also spots labels the student wrote ("a)", "2.", "Q3") and makes sure
carry-forward protection never links a step to a mistake in a different question.
"""
from __future__ import annotations

import re
from typing import List, Optional

from .schemas import QuestionInfo, Stage1TranscriptionOutput, Stage2GradingAndAffectOutput, StepEvaluation

# "a)", "b.", "2)", "2a)", "Q3:", "Question 4.", "(c)", optionally inside \text{...}. A label
# must be followed by ) . or :, and "1.5" is a number, not a label.
_LABEL = re.compile(
    r"^\s*(?:\\text\{\s*)?\(?\s*(?:q(?:uestion)?\s*)?(\d{1,2}[a-h]?|[a-h])\s*(?:\)|\.(?!\d)|:)\s*\}?\s*",
    re.IGNORECASE,
)


def written_label(latex: str) -> str:
    """The question label the student wrote at the start of a line, or ""."""
    m = _LABEL.match(latex or "")
    return m.group(1).lower() if m else ""


def strip_label(latex: str) -> str:
    """The line without the student's own label ("a) AB = 5" -> "AB = 5")."""
    m = _LABEL.match(latex or "")
    return latex[m.end():] if m and latex[m.end():].strip() else latex


def _norm(label: str) -> str:
    return re.sub(r"[^0-9a-z]", "", (label or "").lower())


def split_by_question(
    stage1: Optional[Stage1TranscriptionOutput], stage2: Stage2GradingAndAffectOutput
) -> Stage2GradingAndAffectOutput:
    """Give every step a question label and attach the printed questions.

    Order of evidence for each step: the grader's label, the transcriber's label for the
    same line, then a label the student wrote at the start of the line. A step with no
    label stays in the question above it. When nothing is labelled the page is one question.
    """
    lines = {l.line_number: l for l in (stage1.lines if stage1 else [])}
    current = ""
    seen: List[str] = []
    steps: List[StepEvaluation] = []
    for s in stage2.step_evaluations:
        line = lines.get(s.step_number)
        label = _norm(s.question_label) or _norm(line.question_label if line else "") or written_label(s.student_latex)
        if label and label != current:
            current = label
        if current and current not in seen:
            seen.append(current)
        steps.append(s.model_copy(update={"question_label": current}))

    # The first question may be unlabelled ("" then "a"): give it its own place in the order.
    if steps and steps[0].question_label == "" and seen:
        seen.insert(0, "")

    # Carry-forward only protects a step that follows a mistake in the same question.
    fixed: List[StepEvaluation] = []
    wrong_in: set[str] = set()
    for s in steps:
        if not s.is_correct:
            wrong_in.add(s.question_label)
        elif s.is_carry_forward_consistent and s.question_label not in wrong_in:
            s = s.model_copy(update={"is_carry_forward_consistent": False})
        fixed.append(s)

    printed = {_norm(q.label): q for q in (stage1.questions if stage1 else [])}
    questions = [
        QuestionInfo(label=label, printed_text=printed[label].printed_text if label in printed else "")
        for label in seen
    ]
    # Printed questions whose label didn't match (e.g. the first question was unlabelled)
    # fill the gaps in page order.
    spare = [q for q in (stage1.questions if stage1 else []) if _norm(q.label) not in seen]
    for i, q in enumerate(questions):
        if not q.printed_text and spare:
            questions[i] = q.model_copy(update={"printed_text": spare.pop(0).printed_text})
    # One question on the page: keep its printed text if the transcriber found it.
    if not questions and stage1 and len(stage1.questions) == 1:
        questions = [QuestionInfo(label="", printed_text=stage1.questions[0].printed_text)]
    return stage2.model_copy(update={"step_evaluations": fixed, "questions": questions})
