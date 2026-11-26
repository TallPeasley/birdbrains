"""Quirks: strengths the grader awards (mistakes are shown as antiquirks)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from birdbrains import quirks as Q
from birdbrains.codes import CODES
from birdbrains.schemas import QuestionGradingOutput, RequirementCheck
from birdbrains.taxonomy import PILLAR_NAMES, cached_context_text

ROOT = Path(__file__).parents[2]


def test_four_quirks_per_pillar_and_opposes_are_real_codes():
    Q._check()
    for pillar in PILLAR_NAMES:
        assert sum(1 for q in Q.QUIRKS.values() if q.pillar == pillar) == 4
    for q in Q.QUIRKS.values():
        assert q.id.startswith(f"QK_{q.pillar}_")
        assert q.opposes and all(c in CODES for c in q.opposes)
        assert q.plain_name and q.earned_line and q.how_to_earn


def test_quirks_are_in_cached_context_and_site_imports_same_file():
    text = cached_context_text()
    assert "QK_TST_CHECKED_ANSWER" in text and "requirement_checks" in text
    ts = (ROOT / "lib" / "quirks.ts").read_text()
    assert "backend/birdbrains/quirks.json" in ts


def test_quirks_doc_is_fresh():
    import importlib.util

    spec = importlib.util.spec_from_file_location("doc", ROOT / "backend" / "tools" / "error_codes_doc.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert (ROOT / "docs" / "QUIRKS.md").read_text() == mod.render_quirks()


def test_unknown_check_id_is_rejected():
    with pytest.raises(Exception):
        RequirementCheck(check_id="QK_MADE_UP", status="MET")


@pytest.mark.parametrize("met,tested,status", [
    (4, 4, "QUIRK"), (3, 4, "QUIRK"), (2, 4, "NEUTRAL"), (1, 4, "ANTIQUIRK"), (0, 4, "ANTIQUIRK"),
    (2, 3, "QUIRK"), (1, 3, "NEUTRAL"), (0, 3, "ANTIQUIRK"),
    (2, 2, "QUIRK"), (1, 2, "NEUTRAL"), (0, 2, "ANTIQUIRK"),
    (1, 1, "QUIRK"), (0, 1, "ANTIQUIRK"), (0, 0, "NOT_SHOWN"),
])
def test_pillar_rule_scales_with_checks_that_apply(met, tested, status):
    assert Q.pillar_status(met, tested) == status


def _question(errors, checks, steps=None, number="1"):
    steps = steps if steps is not None else [
        {"step_number": 1, "student_latex": "2x = 6", "is_correct": True, "is_carry_forward_consistent": False,
         "pillar": None, "error_code": None, "explanation": "ok"},
        {"step_number": 2, "student_latex": "x = 4", "is_correct": False, "is_carry_forward_consistent": False,
         "pillar": "FAC", "error_code": "FAC_ARITHMETIC_SLIP", "explanation": "6/2 is 3"},
    ]
    return QuestionGradingOutput.model_validate({
        "question_number": number, "problem_statement": "Solve 2x = 6",
        "answer_key": {"method_used": "divide", "steps": [], "final_answer": "x = 3", "answer_verification": "2(3)=6"},
        "final_answer_verification": {"student_final_answer": "x = 4", "resubstitution_check": "8 != 6",
                                      "satisfies_initial_question": False, "discrepancy_note": ""},
        "key_step_checks": [], "step_evaluations": steps,
        "identified_errors": [
            {"pillar": e[:3], "error_code": e, "description": "d", "target_entity": "t",
             "is_cascading_consequence": False} for e in errors
        ],
        "requirement_checks": [{"check_id": c, "status": st, "step_number": n, "evidence": "e"} for c, st, n in checks],
        "pillar_scores": [], "sentiment_entities": [], "aggregate_valence": 0, "aggregate_friction": 0,
        "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
        "supportive_framing_message": "", "parent_insight": "",
    })


def test_clean_fills_all_24_and_enforces_rules():
    q = Q.clean_requirement_checks(_question(["FAC_ARITHMETIC_SLIP"], [
        ("QK_FAC_ACCURATE_ARITHMETIC", "MET", None),  # contradicted by the slip -> MISSED
        ("QK_CON_BALANCED", "MET", 2),  # points at a wrong line -> NOT_TESTED
        ("QK_STR_CLEAR_SETUP", "MET", 1),
        ("QK_STR_CLEAR_SETUP", "MISSED", 1),  # duplicate: first wins
    ]))
    by = {c.check_id: c.status.value for c in q.requirement_checks}
    assert len(q.requirement_checks) == 24 and list(by) == list(Q.CHECKS)
    assert by["QK_FAC_ACCURATE_ARITHMETIC"] == "MISSED"
    assert by["QK_CON_BALANCED"] == "NOT_TESTED"
    assert by["QK_STR_CLEAR_SETUP"] == "MET"
    assert by["QK_TST_CHECKED_ANSWER"] == "NOT_TESTED"


def test_blank_question_meets_nothing():
    q = Q.clean_requirement_checks(_question(["TST_BLANK"], [("QK_TST_KEPT_GOING", "MET", None)], steps=[]))
    by = {c.check_id: c.status.value for c in q.requirement_checks}
    assert "MET" not in by.values()
    assert by["QK_TST_KEPT_GOING"] == "MISSED"  # opposes TST_BLANK


def test_question_pillars_and_upload_rollup():
    full = [("QK_CON_RULE_APPLIED", "MET", 1), ("QK_CON_BALANCED", "MET", 1), ("QK_CON_EXPLAINED_WHY", "MET", None),
            ("QK_CON_RESTRICTION_NOTED", "MISSED", None),  # CON 3 of 4 -> quirk
            ("QK_TST_CHECKED_ANSWER", "MISSED", None), ("QK_TST_ANSWERED_ALL_PARTS", "MISSED", None),
            ("QK_TST_KEPT_GOING", "MET", None), ("QK_TST_CAUGHT_OWN_MISTAKE", "MISSED", None)]  # TST 1 of 4
    q1 = Q.clean_requirement_checks(_question([], full))
    pillars = Q.question_pillars(q1)
    assert pillars["CON"]["status"] == "QUIRK" and (pillars["CON"]["met"], pillars["CON"]["tested"]) == (3, 4)
    assert pillars["TST"]["status"] == "ANTIQUIRK"
    assert pillars["COM"]["status"] == "NOT_SHOWN"
    # Second question: CON rule missed twice over. The upload adds up every check on every
    # question: CON 3 of 4 + 0 of 1 = 3 of 5 -> neutral. A tied check shows as missed.
    q2 = Q.clean_requirement_checks(_question([], [("QK_CON_RULE_APPLIED", "MISSED", None)], number="2"))
    statuses, checks = Q.upload_summary([q1, q2])
    assert checks["QK_CON_RULE_APPLIED"] == ("MISSED", "2")
    assert checks["QK_CON_BALANCED"] == ("MET", "1")
    assert Q.upload_pillar_counts([q1, q2])["CON"] == (3, 5)
    assert statuses["CON"] == "NEUTRAL" and statuses["TST"] == "ANTIQUIRK"


def test_tally_counts_quirks_and_antiquirks_per_pillar():
    rows = {r["pillar"]: r for r in Q.tally([
        ("2026-11-20T10:00:00Z", {"CON": "QUIRK", "TST": "ANTIQUIRK"}, {"QK_CON_RULE_APPLIED": ("MET", None)}),
        ("2026-11-22T10:00:00Z", {"CON": "QUIRK", "TST": "NEUTRAL"}, {"QK_CON_RULE_APPLIED": ("MISSED", None)}),
    ])}
    assert list(rows) == list(Q.PILLARS)
    assert rows["CON"]["quirks"] == 2 and rows["CON"]["firstQuirkAt"] == "2026-11-20T10:00:00Z"
    assert rows["TST"]["antiquirks"] == 1 and rows["TST"]["neutral"] == 1 and rows["TST"]["lastStatus"] == "NEUTRAL"
    con_rule = next(c for c in rows["CON"]["checks"] if c["checkId"] == "QK_CON_RULE_APPLIED")
    assert (con_rule["met"], con_rule["missed"]) == (1, 1)
    assert len(rows["COM"]["checks"]) == 4 and rows["COM"]["lastStatus"] is None


def test_old_earned_quirks_field_still_loads():
    q = _question([], [])
    raw = q.model_dump(mode="json")
    raw["earned_quirks"] = [{"quirk_id": "QK_CON_RULE_APPLIED", "step_number": 1, "evidence": "x"}]
    assert QuestionGradingOutput.model_validate(raw).requirement_checks == []


def test_quirks_json_ids_unique():
    raw = json.loads((ROOT / "backend" / "birdbrains" / "quirks.json").read_text())
    ids = [q["id"] for q in raw["quirks"]]
    assert len(ids) == len(set(ids)) == 24
