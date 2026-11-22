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
