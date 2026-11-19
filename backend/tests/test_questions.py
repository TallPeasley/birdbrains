"""Pages with several questions: steps are split, numbered per question, and never
carry-forward-protected by a mistake in another question."""
from birdbrains.projections import step_diagnostics
from birdbrains.questions import segment_questions, split_by_question, strip_label, written_label
from birdbrains.schemas import Stage1TranscriptionOutput, Stage2GradingAndAffectOutput


def stage1(lines, questions=()):
    return Stage1TranscriptionOutput.model_validate({
        "submission_id": "s", "overall_ocr_confidence": 0.9,
        "lines": [{"line_number": i + 1, "raw_latex": t, "bounding_box_normalized": [0, 0, 1, 1],
                   "confidence_score": 0.9, "visual_affect_markers": [], "question_label": q}
                  for i, (t, q) in enumerate(lines)],
        "questions": [{"label": l, "printed_text": p} for l, p in questions],
    })


def stage2(steps):
    return Stage2GradingAndAffectOutput.model_validate({
        "submission_id": "s", "identified_errors": [], "sentiment_entities": [], "aggregate_valence": 0,
        "aggregate_friction": 0, "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
        "step_evaluations": [{"step_number": i + 1, "student_latex": t, "is_correct": ok,
                              "is_carry_forward_consistent": cf, "explanation": "."}
                             for i, (t, ok, cf) in enumerate(steps)],
    })


def test_written_labels():
    assert written_label("a) \\overline{AB} = 5") == "a"
    assert written_label("2. x + y = 4") == "2"
    assert written_label("Q3: y = 2") == "3"
    assert written_label("(b) AB = 3") == "b"
    assert written_label("1.5x = 3") == ""
    assert written_label("2(x + 3) = 4") == ""
    assert written_label("x = 3") == ""
    assert strip_label("a) AB = 5") == "AB = 5"


def test_student_label_starts_a_new_question_and_numbers_restart():
    """The screenshot case: a linear system (no label), then "a)" for a triangle."""
    s2 = stage2([
        ("2x + 3y = 6", True, False),
        ("y = -30/7", False, False),
        ("x = 12/7", True, True),
        ("a) \\overline{AB} = \\sqrt{20}", True, False),
        ("\\overline{BC} = \\sqrt{52}", True, True),  # the grader wrongly linked it to question 1
        ("Not isosceles.", True, False),
    ])
    s1 = stage1([("", "")] * 6, questions=[("1", "Solve the system 2x + 3y = 6, 4x - y = 2."),
                                            ("2", "Is triangle ABC isosceles?")])
    out = split_by_question(s1, s2)
    assert [s.question_label for s in out.step_evaluations] == ["", "", "", "a", "a", "a"]
    assert [q.printed_text for q in out.questions] == ["Solve the system 2x + 3y = 6, 4x - y = 2.",
                                                       "Is triangle ABC isosceles?"]
    # Carry-forward stays within question 1 only.
    assert out.step_evaluations[2].is_carry_forward_consistent is True
    assert out.step_evaluations[4].is_carry_forward_consistent is False
    api = step_diagnostics(out)
    assert [d["questionStepNumber"] for d in api] == [1, 2, 3, 1, 2, 3]
    assert api[3]["studentInput"] == "\\overline{AB} = \\sqrt{20}"


def test_transcriber_labels_are_used():
    s1 = stage1([("x = 1", "1"), ("x = 2", "1"), ("y = 3", "2")], questions=[("1", "Q one"), ("2", "Q two")])
    out = split_by_question(s1, stage2([("x = 1", True, False), ("x = 2", True, False), ("y = 3", True, False)]))
    assert [s.question_label for s in out.step_evaluations] == ["1", "1", "2"]
    assert [(q.label, q.printed_text) for q in out.questions] == [("1", "Q one"), ("2", "Q two")]


def test_single_question_is_unchanged():
    s1 = stage1([("x = 1", ""), ("x = 2", "")], questions=[("1", "Solve x.")])
    out = split_by_question(s1, stage2([("x = 1", True, False), ("x = 2", True, False)]))
    assert [s.question_label for s in out.step_evaluations] == ["", ""]
    assert [q.printed_text for q in out.questions] == ["Solve x."]
    assert [d["questionStepNumber"] for d in step_diagnostics(out)] == [1, 2]


def segmented(questions):
    return Stage1TranscriptionOutput.model_validate({
        "submission_id": "s", "overall_ocr_confidence": 0.9,
        "questions": [{"question_number": n, "problem_statement": p,
                       "lines": [{"line_number": i + 1, "raw_latex": t, "bounding_box_normalized": [0, 0, 1, 1],
                                  "confidence_score": 0.9, "visual_affect_markers": []}
                                 for i, t in enumerate(lines)]}
                      for n, p, lines in questions],
    })


def test_reading_that_merged_two_numbered_questions_is_split():
    s1 = segmented([("1", "Solve the system.", ["1. 2x + 3y = 6", "y = 2", "2. AB = 5", "BC = 5"])])
    out = segment_questions(s1).resolved_questions()
    assert [q.question_number for q in out] == ["1", "2"]
    assert [[l.line_number for l in q.lines] for q in out] == [[1, 2], [1, 2]]
    assert out[0].problem_statement == "Solve the system." and out[1].problem_statement == ""


def test_sub_parts_stay_in_their_question():
    s1 = segmented([("3", "Triangle ABC.", ["a) AB = 5", "b) BC = 5", "Not isosceles."])])
    assert segment_questions(s1) is s1


def test_number_that_is_already_its_own_question_is_left_alone():
    s1 = segmented([("1", "", ["x = 1", "2. x = 2"]), ("2", "", ["y = 3"])])
    assert [q.question_number for q in segment_questions(s1).resolved_questions()] == ["1", "2"]


def test_older_transcription_format_still_loads():
    s1 = stage1([("x = 1", "1"), ("x = 2", ""), ("y = 3", "2")], questions=[("1", "Q one"), ("2", "Q two")])
    qs = s1.resolved_questions()
    assert [(q.question_number, q.problem_statement, len(q.lines)) for q in qs] == [("1", "Q one", 2), ("2", "Q two", 1)]
    assert qs[1].lines[0].line_number == 1
