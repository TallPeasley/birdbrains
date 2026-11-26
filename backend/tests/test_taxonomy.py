"""Six-pillar taxonomy: the code list, prompt text and loading gradings stored with old ids."""
import json
import re
from pathlib import Path

from birdbrains import taxonomy as T
from birdbrains.codes import CODES, ERROR_CODE_PATTERN, LEGACY_CODES
from birdbrains.projections import plain
from birdbrains.schemas import PillarEnum, RootCauseErrorItem, StepEvaluation

OLD_IDS = {f"{p}-0{i}" for p in ("CON", "PRC", "FAC", "TST") for i in range(1, 5)}


def test_six_pillars_eight_codes_each():
    assert [p.value for p in PillarEnum] == list(T.PILLAR_NAMES) == ["CON", "STR", "PRC", "FAC", "COM", "TST"]
    assert len(CODES) == 48
    for p in PillarEnum:
        assert sum(c.pillar == p.value for c in CODES.values()) == 8
    assert sum(T.PILLAR_MAX_SCORES.values()) == 10


def test_every_code_is_complete_and_readable():
    for c in CODES.values():
        assert re.fullmatch(r"(CON|STR|PRC|FAC|COM|TST)_[A-Z]+(_[A-Z]+)*", c.id), c.id
        assert c.id[:3] == c.pillar
        for field in (c.name, c.plain_name, c.student_help, c.description, c.example, c.remediation):
            assert field.strip(), c.id
        assert c.tell_apart, f"{c.id} has no tell-apart note"
        for t in c.tell_apart:
            assert t.how and (t.code is None or (t.code in CODES and t.code != c.id)), (c.id, t.code)
        assert not re.search(r"\b[A-Z]{3}[-_][A-Z0-9]", c.student_help + c.plain_name), c.id


def test_every_old_id_maps_once():
    assert set(LEGACY_CODES) == OLD_IDS
    assert not set(LEGACY_CODES) & set(CODES)


def test_pattern_accepts_exactly_the_codes():
    assert all(re.match(ERROR_CODE_PATTERN, c) for c in CODES)
    assert not any(re.match(ERROR_CODE_PATTERN, c) for c in OLD_IDS | {"CON_MADE_UP", "STR-01"})


def test_prompt_text_lists_every_code_under_its_pillar():
    text = T.cached_context_text()
    for code in CODES:
        assert f"- {code} (" in text
    for old in OLD_IDS:
        assert old not in text
    assert len(text) > 16000  # big enough for an explicit Gemini context cache


def test_site_reads_the_same_file():
    ts = (Path(__file__).parents[2] / "lib" / "errorCodes.ts").read_text()
    assert "backend/birdbrains/error_codes.json" in ts
    raw = json.loads((Path(__file__).parents[1] / "birdbrains" / "error_codes.json").read_text())
    assert [c["id"] for c in raw["codes"]] == list(CODES)


def test_old_ids_load_under_new_pillar():
    e = RootCauseErrorItem.model_validate({"pillar": "CON", "error_code": "CON-02", "description": "d",
                                           "target_entity": "x", "is_cascading_consequence": False})
    assert (e.pillar, e.error_code) == (PillarEnum.STR, "STR_FORMULA_MISSELECTION")
    s = StepEvaluation.model_validate({"step_number": 1, "student_latex": "x", "is_correct": False,
                                       "is_carry_forward_consistent": False, "pillar": "TST",
                                       "error_code": "TST-02", "explanation": "e"})
    assert (s.pillar, s.error_code) == (PillarEnum.COM, "COM_MISSING_UNITS")
    kept = RootCauseErrorItem.model_validate({"pillar": "PRC", "error_code": "PRC-03", "description": "d",
                                              "target_entity": "x", "is_cascading_consequence": False})
    assert (kept.pillar, kept.error_code) == (PillarEnum.PRC, "PRC_SIGN_OR_FACTOR_DROPPED")


def test_plain_scrubs_new_and_old_codes():
    assert plain("Units missing (COM_MISSING_UNITS). See STR_NO_VIABLE_PLAN and TST-01.") == \
        "Units missing. See no clear plan and answered a different question."


def test_error_codes_doc_is_up_to_date():
    import importlib.util
    spec = importlib.util.spec_from_file_location("ecdoc", Path(__file__).parents[1] / "tools" / "error_codes_doc.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    doc = (Path(__file__).parents[2] / "docs" / "ERROR_CODES.md").read_text()
    assert doc == mod.render(), "run python backend/tools/error_codes_doc.py"
