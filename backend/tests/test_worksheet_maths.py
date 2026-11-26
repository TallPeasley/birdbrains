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
    # A paragraph step is only logged now: failing it cost students their worksheet.
    assert lint_worksheet(GOOD.model_copy(update={"faded_scaffolding": steps})) == []

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
    other = root.model_copy(update={"error_code": "STR_FORMULA_MISSELECTION"})
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
    assert lint_worksheet(ws) == []  # logged, not failed


def test_tidy_repairs_teaching_problems_instead_of_failing_the_sheet():
    from birdbrains.math_lint import NEUTRAL_CHECK, NEUTRAL_HINT, lint_worksheet, tidy_worksheet

    steps = [s.model_copy() for s in GOOD.faded_scaffolding]
    blanks = [s for s in steps if s.scaffolding_type == "PARTIAL_BLANK"]
    blanks[0].given_content, blanks[0].blank_placeholder, blanks[0].hint = "a^2 = [ __ ]", "28", "Work out $52 - 24$."
    blanks[1].given_content, blanks[1].blank_placeholder = "5 = 3(1) + [ __ ]", "b"
    steps[-1].hint = f"You should get ${steps[-1].given_content}$."
    t = GOOD.independent_transfer.model_copy(update={"answer": "x = 6, y = 2"})
    t.metacognitive_checklist = [*t.metacognitive_checklist[:2], "I found x = 6 and y = 2"]
    ws = GOOD.model_copy(update={"faded_scaffolding": steps, "independent_transfer": t})
    assert lint_worksheet(ws)  # as the model wrote it
    fixed = tidy_worksheet(ws)
    assert lint_worksheet(fixed) == []
    a, b = [s for s in fixed.faded_scaffolding if s.step_number in (blanks[0].step_number, blanks[1].step_number)]
    assert a.hint == NEUTRAL_HINT and a.blank_placeholder == "28"
    assert b.scaffolding_type == "GIVEN" and b.given_content == "5 = 3(1) + b" and b.blank_placeholder is None
    assert fixed.faded_scaffolding[-1].hint == NEUTRAL_HINT
    assert fixed.independent_transfer.metacognitive_checklist[-1] == NEUTRAL_CHECK


def test_one_blank_for_a_whole_sum_is_split_so_the_structure_shows():
    from birdbrains.math_lint import split_big_blank, tidy_worksheet

    # Live, Nov 25: "d = \sqrt{[ __ ]}" showed a lone box under the root.
    assert split_big_blank("d = \\sqrt{[ __ ]}", ["8^2 + (-6)^2"]) == ("d = \\sqrt{[ __ ]^2 + ([ __ ])^2}", "8, -6")
    assert split_big_blank("y = 3(x + [ __ ])^2", ["2"]) is None
    assert split_big_blank("[ __ ] = 0", ["(x + 2)(x + 3)"]) is None
    steps = with_steps(("GIVEN", "d = \\sqrt{(5 - (-3))^2 + (-1 - 5)^2}", None),
                       ("PARTIAL_BLANK", "d = \\sqrt{[ __ ]}", "8^2 + (-6)^2"), ("INDEPENDENT", "d = 10", None))
    step = tidy_worksheet(steps).faded_scaffolding[1]
    assert step.given_content.count("[ __ ]") == 2 and step.blank_placeholder == "8, -6"
    assert check_worksheet_maths(tidy_worksheet(steps)) == []


def test_make_it_now_asks_for_sections_a_to_c_then_the_practice_set():
    from types import SimpleNamespace

    from birdbrains import batch_engine as B
    from birdbrains.schemas import CourseEnum, ScaffoldingModeEnum
    from birdbrains.fake import FakePipeline
    from birdbrains.pipeline import SubmissionContext

    fake = FakePipeline()
    ctx = SubmissionContext("sub_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square")
    item = B.FlaggedGrading("grd_abcdefghijkl", CourseEnum.MPM2D, "x", ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE,
                            fake.run_stage2(ctx, fake.run_stage1(ctx, [])))
    calls = []

    def generate(model, contents, config):
        calls.append((contents, config.response_json_schema))
        if "practice_set" in config.response_json_schema["properties"] and len(config.response_json_schema["properties"]) == 1:
            return SimpleNamespace(text=B.PracticeSetOutput(practice_set=GOOD.practice_set).model_dump_json())
        return SimpleNamespace(text=GOOD.model_copy(update={"practice_set": []}).model_dump_json())

    engine = B.GeminiBatchEngine(None, client=SimpleNamespace(models=SimpleNamespace(generate_content=generate)))
    core = engine.generate_now(item, core_only=True)
    assert core.practice_set == [] and "practice_set" not in calls[0][1]["properties"]
    assert calls[0][0].endswith(B.CORE_NOTE)
    practice = engine.generate_practice(item, core)
    assert len(practice) == len(GOOD.practice_set) and GOOD.title in calls[1][0]
    # A short or empty set fails the checks and is asked for again, then given up on.
    bad = B.PracticeSetOutput(practice_set=GOOD.practice_set[:2]).model_dump_json()
    engine._client = SimpleNamespace(models=SimpleNamespace(generate_content=lambda **k: SimpleNamespace(text=bad)))
    with pytest.raises(ValueError, match="2 problems"):
        engine.generate_practice(item, core)


def test_saved_worksheets_are_repaired_when_shown():
    from birdbrains.projections import to_api_worksheet

    ws = with_steps(("GIVEN", "d = \\sqrt{(5 - (-3))^2 + (-1 - 5)^2}", None),
                    ("PARTIAL_BLANK", "d = \\sqrt{[ __ ]}", "8^2 + (-6)^2"),
                    ("PARTIAL_BLANK", "d = \\sqrt{[ __ ]}", "64 + 36"), ("INDEPENDENT", "d = 10", None))
    api = to_api_worksheet({"worksheetId": "wks_1", "gradingId": "grd_1", "content": ws.model_dump(mode="json")})
    two, three = api.sectionB_FadedScaffolding[1:3]
    assert two.givenContent == "d = \\sqrt{[ __ ]^2 + ([ __ ])^2}" and two.blankPlaceholder == "8, -6"
    assert three.givenContent == "d = \\sqrt{[ __ ] + [ __ ]}" and three.blankPlaceholder == "64, 36"
