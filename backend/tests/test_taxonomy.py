"""Six-pillar taxonomy: codes, prompt text and loading gradings stored with old codes."""
import re

from birdbrains import taxonomy as T
from birdbrains.projections import plain
from birdbrains.schemas import ERROR_CODE_PATTERN, LEGACY_CODES, PillarEnum, RootCauseErrorItem, StepEvaluation


def test_six_pillars_four_codes_each():
    assert [p.value for p in PillarEnum] == list(T.PILLAR_NAMES) == ["CON", "STR", "PRC", "FAC", "COM", "TST"]
    assert len(T.ERROR_CODES) == 24
    for p in PillarEnum:
        assert sum(c.startswith(p.value) for c in T.ERROR_CODES) == 4
    assert sum(T.PILLAR_MAX_SCORES.values()) == 10


def test_pattern_accepts_exactly_the_codes():
    every = {f"{p}-0{i}" for p in T.PILLAR_NAMES for i in range(10)}
    assert {c for c in every if re.match(ERROR_CODE_PATTERN, c)} == set(T.ERROR_CODES)


def test_retired_ids_are_not_reused():
    assert not set(LEGACY_CODES) & set(T.ERROR_CODES)
    assert all(new in T.ERROR_CODES for new in LEGACY_CODES.values())


def test_prompt_text_lists_every_code_under_its_pillar():
    text = T.cached_context_text()
    for code in T.ERROR_CODES:
        assert code in text
    for old in LEGACY_CODES:
        assert old not in text
    assert "Six-Pillar" in text


def test_old_codes_load_under_new_pillar():
    e = RootCauseErrorItem.model_validate({"pillar": "CON", "error_code": "CON-02", "description": "d",
                                           "target_entity": "x", "is_cascading_consequence": False})
    assert (e.pillar, e.error_code) == (PillarEnum.STR, "STR-01")
    s = StepEvaluation.model_validate({"step_number": 1, "student_latex": "x", "is_correct": False,
                                       "is_carry_forward_consistent": False, "pillar": "TST",
                                       "error_code": "TST-02", "explanation": "e"})
    assert (s.pillar, s.error_code) == (PillarEnum.COM, "COM-02")
    kept = RootCauseErrorItem.model_validate({"pillar": "TST", "error_code": "TST-03", "description": "d",
                                              "target_entity": "x", "is_cascading_consequence": False})
    assert (kept.pillar, kept.error_code) == (PillarEnum.TST, "TST-03")


def test_plain_scrubs_new_and_old_codes():
    assert plain("Units missing (COM-02). See STR-03 and TST-01.") == \
        "Units missing. See no clear plan and answered a different question."
