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
