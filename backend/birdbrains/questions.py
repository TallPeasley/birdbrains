"""Split a page into its questions.

A photo often holds more than one question (a linear system, then a triangle). The
reading step is asked to segment the page by question, and each question is then
graded on its own. These checks do not rely on the model alone:

* ``segment_questions`` splits a reading where two numbered questions ended up in one
  entry, using the numbers the student wrote ("1.", "2)", "Q3").
* ``split_by_question`` is for gradings that come back as one flat list of steps
  (older records): it labels each step with its question and makes sure carry-forward
  protection never links a step to a mistake in a different question.
"""
from __future__ import annotations

import re
from typing import List, Optional

from .schemas import (
    QuestionInfo,
    Stage1LineTranscription,
    Stage1QuestionTranscription,
    Stage1TranscriptionOutput,
    Stage2GradingAndAffectOutput,
    StepEvaluation,
)

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


def _question_number(label: str) -> str:
    """The question a label points at: "2b" -> "2", "3" -> "3", "b" -> "" (a sub-part)."""
    m = re.match(r"\d+", label or "")
    return m.group(0) if m else ""


def segment_questions(stage1: Stage1TranscriptionOutput) -> Stage1TranscriptionOutput:
    """Split any question whose lines start a new numbered question part-way through.

    Only numbers split ("1." then "2."); letters are sub-parts of the same question and
    stay together. A number that is already its own question elsewhere is left alone.
    Lines are renumbered from 1 within each question.
    """
    questions = stage1.resolved_questions()
    if not questions:
        return stage1
    taken = {_norm(q.question_number) for q in questions}
    out: List[Stage1QuestionTranscription] = []
    for q in questions:
        own = _question_number(_norm(q.question_number))
        pieces: List[tuple[str, List[Stage1LineTranscription]]] = [(q.question_number, [])]
        current = own
        for line in q.lines:
            num = _question_number(_norm(line.question_label) or written_label(line.raw_latex))
            if num and current and num != current and num not in taken and pieces[-1][1]:
                pieces.append((num, []))
                taken.add(num)
            if num and not current:
                current = num
            elif num and pieces[-1][0] == num:
                current = num
            pieces[-1][1].append(line)
        for i, (number, lines) in enumerate(pieces):
            out.append(Stage1QuestionTranscription(
                question_number=number,
                problem_statement=q.problem_statement if i == 0 else "",
                lines=[l.model_copy(update={"line_number": n + 1}) for n, l in enumerate(lines)],
            ))
    if len(out) == len(questions):
        return stage1
    return stage1.model_copy(update={"questions": out, "lines": []})


def split_by_question(
    stage1: Optional[Stage1TranscriptionOutput], stage2: Stage2GradingAndAffectOutput
) -> Stage2GradingAndAffectOutput:
    """Give every step of a flat grading a question label and attach the printed questions.

    Gradings made question by question (``question_analyses``) are already split and are
    returned unchanged. For a flat list, the order of evidence for each step is: the
    grader's label, the reading's question for the same line, then a label the student
    wrote at the start of the line. A step with no label stays in the question above it.
    When nothing is labelled the page is one question.
    """
    if stage2.question_analyses:
        return stage2
    segmented = stage1.resolved_questions() if stage1 else []
    multi = len(segmented) > 1
    # Page order line number -> (line, its question). Flat readings keep their own numbers.
    lines: dict[int, tuple[Stage1LineTranscription, str]] = {}
    if stage1 and stage1.lines:
        lines = {l.line_number: (l, l.question_label) for l in stage1.lines}
    else:
        n = 0
        for q in segmented:
            for l in q.lines:
                n += 1
                lines[n] = (l, q.question_number if multi else "")
    current = ""
    seen: List[str] = []
    steps: List[StepEvaluation] = []
    for s in stage2.step_evaluations:
        line, line_label = lines.get(s.step_number, (None, ""))
        label = _norm(s.question_label) or _norm(line_label) or written_label(s.student_latex)
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

    printed = {_norm(q.question_number): q.problem_statement for q in segmented}
    questions = [QuestionInfo(label=label, printed_text=printed.get(label, "")) for label in seen]
    # Printed questions whose label didn't match (e.g. the first question was unlabelled)
    # fill the gaps in page order.
    spare = [q.problem_statement for q in segmented if _norm(q.question_number) not in seen and q.problem_statement]
    for i, q in enumerate(questions):
        if not q.printed_text and spare:
            questions[i] = q.model_copy(update={"printed_text": spare.pop(0)})
    # One question on the page: keep its printed text if the reading found it.
    if not questions and len(segmented) == 1 and segmented[0].problem_statement:
        questions = [QuestionInfo(label="", printed_text=segmented[0].problem_statement)]
    return stage2.model_copy(update={"step_evaluations": fixed, "questions": questions})
