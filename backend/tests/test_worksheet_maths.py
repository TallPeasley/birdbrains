"""The sympy check of a worksheet's practice steps: wrong maths is caught, and lines it
can't read are skipped rather than failed."""
import pytest

from birdbrains.fake import fake_worksheet
from birdbrains.worksheet_maths import check_worksheet_maths

GOOD = fake_worksheet(None)


def with_steps(*steps):
    base = GOOD.faded_scaffolding[0]
    out = []
    for n, (kind, content, answer) in enumerate(steps, 1):
        out.append(base.model_copy(update={"step_number": n, "scaffolding_type": kind,
                                           "given_content": content, "blank_placeholder": answer}))
    return GOOD.model_copy(update={"faded_scaffolding": out})


def test_the_sample_worksheet_is_right():
    assert check_worksheet_maths(GOOD) == []


@pytest.mark.parametrize("steps", [
    # Linear equation, blanks filled in.
    [("GIVEN", "3x + 4 = 19", None), ("PARTIAL_BLANK", "3x = [ __ ]", "15"), ("INDEPENDENT", "x = 5", None)],
    # Factoring, then one factor's root.
    [("GIVEN", "x^2 - 5x + 6 = 0", None), ("PARTIAL_BLANK", "(x - [ __ ])(x - 3) = 0", "2"),
     ("INDEPENDENT", "x - 2 = 0", None)],
    # Rounded answer.
    [("GIVEN", "x^2 = 5", None), ("INDEPENDENT", "x = 2.24", None)],
    # Words, trig, "or", vertex points: skipped, not failed.
    [("GIVEN", "Vertex: (-3, -13)", None), ("PARTIAL_BLANK", "sin 38° = [ __ ]", "0.616"),
     ("INDEPENDENT", "x = 2 or x = 3", None)],
    [("GIVEN", "Half of 6 is 3, and (6/2)^2 = 9", None), ("INDEPENDENT", "\\frac{1}{2}x = 4", None)],
])
def test_right_or_unreadable_steps_pass(steps):
    assert check_worksheet_maths(with_steps(*steps)) == []


@pytest.mark.parametrize("steps,problem", [
    ([("GIVEN", "3x + 4 = 19", None), ("PARTIAL_BLANK", "3x = [ __ ]", "23"), ("INDEPENDENT", "x = 5", None)],
     "answer the step before does not have"),
    ([("GIVEN", "y = 3(x^2 + 4x) + 1", None), ("PARTIAL_BLANK", "y = 3(x + 2)^2 - (3 * [ __ ]) + 1", "2"),
      ("INDEPENDENT", "y = 3(x + 2)^2 - 5", None)], "does not follow"),
    ([("GIVEN", "(6/2)^2 = [ __ ]", "6"), ("INDEPENDENT", "x = 1", None)], "is not true"),
])
def test_wrong_maths_is_caught(steps, problem):
    found = check_worksheet_maths(with_steps(*steps))
    assert any(problem in f for f in found), found


def test_factoring_lines_without_an_equals_sign_are_checked():
    from birdbrains.worksheet_maths import maths_report

    right = with_steps(("GIVEN", "3x^2 + 15x + 18", None), ("PARTIAL_BLANK", "3(x^2 + 5x + [ __ ])", "6"),
                       ("INDEPENDENT", "3(x + 2)(x + 3)", None))
    problems, read, steps = maths_report(right)
    assert problems == [] and (read, steps) == (3, 3)
    wrong = with_steps(("GIVEN", "3(x^2 + 5x + 6)", None), ("INDEPENDENT", "3(x + 1)(x + 6)", None))
    assert check_worksheet_maths(wrong) == ["step 2: does not follow from the step before"]
    # A bare number is not something to check.
    assert maths_report(with_steps(("GIVEN", "2x + 5 = 15", None), ("INDEPENDENT", "17", None)))[1] == 1


def test_hints_that_give_the_answer_and_letter_blanks_fail_lint():
    from birdbrains.math_lint import lint_worksheet

    steps = [s.model_copy() for s in GOOD.faded_scaffolding]
    blank = next(s for s in steps if s.scaffolding_type == "PARTIAL_BLANK")
    blank.blank_placeholder = "12, 13"
    blank.given_content = "(x + [ __ ])(x + [ __ ])"
    blank.hint = "The two numbers are 12 and 13."
    last = steps[-1]
    last.hint = f"You should get ${last.given_content}$."
    ws = GOOD.model_copy(update={"faded_scaffolding": steps})
    problems = lint_worksheet(ws)
    assert any("gives the blank's answer away" in p for p in problems)
    assert any("gives the final line away" in p for p in problems)
    blank.blank_placeholder, blank.given_content, blank.hint = "b", "5 = 3(1) + [ __ ]", "Solve for the intercept."
    assert any("just a letter" in p for p in lint_worksheet(ws))
    assert lint_worksheet(GOOD) == []


def test_units_paragraph_steps_checklist_and_target_error():
    from birdbrains.math_lint import lint_worksheet
    from birdbrains.worksheet_maths import maths_report

    # "r = 5.9 cm" and degrees are read once the unit is dropped.
    ws = with_steps(("GIVEN", "r^2 = 34.81", None), ("INDEPENDENT", "r = 5.9 cm", None))
    assert maths_report(ws)[1] == 2
    assert maths_report(with_steps(("GIVEN", "2 \\times 26^\\circ = 52^\\circ", None)))[0:2] == ([], 1)

    steps = [s.model_copy() for s in GOOD.faded_scaffolding]
    steps[0].given_content = "For the system we multiply the first equation by 2, then add them to get 11x = 44"
    assert any("is a sentence" in p for p in lint_worksheet(GOOD.model_copy(update={"faded_scaffolding": steps})))

    t = GOOD.independent_transfer.model_copy(update={"answer": "x = 6, y = 2"})
    t.metacognitive_checklist = [*t.metacognitive_checklist[:2], "I found x = 6 and y = 2"]
    assert any("checklist 3: gives" in p for p in lint_worksheet(GOOD.model_copy(update={"independent_transfer": t})))


def test_prompt_names_the_most_frequent_root_error():
    from birdbrains import batch_engine as B
    from birdbrains.fake import FakePipeline
    from birdbrains.pipeline import SubmissionContext
    from birdbrains.schemas import CourseEnum, ScaffoldingModeEnum

    fake = FakePipeline()
    ctx = SubmissionContext("sub_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square")
    s2 = fake.run_stage2(ctx, fake.run_stage1(ctx, []))
    root = next(e for e in s2.identified_errors if not e.is_cascading_consequence)
    other = root.model_copy(update={"error_code": "CON-02"})
    s2 = s2.model_copy(update={"identified_errors": [other, root, root.model_copy()]})
    item = B.FlaggedGrading("grd_abcdefghijkl", CourseEnum.MPM2D, "x", ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE, s2)
    assert f"Target error: {root.error_code} (2 of 3 root-cause errors)" in B.worksheet_prompt(item)


def test_hints_that_do_the_sum_and_blanks_that_copy_the_prompt_fail_lint():
    from birdbrains.math_lint import lint_worksheet

    steps = [s.model_copy() for s in GOOD.faded_scaffolding]
    blank = next(s for s in steps if s.scaffolding_type == "PARTIAL_BLANK")
    blank.given_content, blank.blank_placeholder = "a^2 = [ __ ]", "28"
    blank.hint = "Work out $52 - 24$."
    ws = GOOD.model_copy(update={"faded_scaffolding": steps})
    assert any("gives the blank's answer away" in p for p in lint_worksheet(ws))
    blank.hint = "Move the known side across by subtracting."
    blank.prompt = "Substitute $x_1 = -3$."
    blank.given_content, blank.blank_placeholder = "x_1 = [ __ ]", "-3"
    assert any("prompt already gives" in p for p in lint_worksheet(ws))
