"""Quirks: strengths the grader awards (mistakes are shown as antiquirks)."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from birdbrains import quirks as Q
from birdbrains.codes import CODES
from birdbrains.schemas import EarnedQuirk, QuestionGradingOutput
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
    assert "QK_TST_CHECKED_ANSWER" in text
    ts = (ROOT / "lib" / "quirks.ts").read_text()
    assert "backend/birdbrains/quirks.json" in ts


def test_quirks_doc_is_fresh():
    import importlib.util

    spec = importlib.util.spec_from_file_location("doc", ROOT / "backend" / "tools" / "error_codes_doc.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert (ROOT / "docs" / "QUIRKS.md").read_text() == mod.render_quirks()


def test_unknown_quirk_id_is_rejected():
    with pytest.raises(Exception):
        EarnedQuirk(quirk_id="QK_MADE_UP", evidence="x")


def _question(errors, quirks, steps=None):
    from birdbrains.fake import FakePipeline  # noqa: F401  (ensures fake data shape stays valid)

    steps = steps or [
        {"step_number": 1, "student_latex": "2x = 6", "is_correct": True, "is_carry_forward_consistent": False,
         "pillar": None, "error_code": None, "explanation": "ok"},
        {"step_number": 2, "student_latex": "x = 4", "is_correct": False, "is_carry_forward_consistent": False,
         "pillar": "FAC", "error_code": "FAC_ARITHMETIC_SLIP", "explanation": "6/2 is 3"},
    ]
    return QuestionGradingOutput.model_validate({
        "question_number": "1", "problem_statement": "Solve 2x = 6",
        "answer_key": {"method_used": "divide", "steps": [], "final_answer": "x = 3", "answer_verification": "2(3)=6"},
        "final_answer_verification": {"student_final_answer": "x = 4", "resubstitution_check": "8 != 6",
                                      "satisfies_initial_question": False, "discrepancy_note": ""},
        "key_step_checks": [], "step_evaluations": steps,
        "identified_errors": [
            {"pillar": e[:3], "error_code": e, "description": "d", "target_entity": "t",
             "is_cascading_consequence": False} for e in errors
        ],
        "earned_quirks": [{"quirk_id": q, "step_number": s, "evidence": "e"} for q, s in quirks],
        "pillar_scores": [], "sentiment_entities": [], "aggregate_valence": 0, "aggregate_friction": 0,
        "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
        "supportive_framing_message": "", "parent_insight": "",
    })


def test_clean_drops_opposed_wrong_step_duplicates_and_caps():
    q = _question(["FAC_ARITHMETIC_SLIP"], [
        ("QK_FAC_ACCURATE_ARITHMETIC", None),  # opposed by the slip
        ("QK_CON_BALANCED", 2),  # points at a wrong line
        ("QK_STR_CLEAR_SETUP", 1),
        ("QK_STR_CLEAR_SETUP", 1),  # duplicate
        ("QK_COM_NEAT_WORK", None),
        ("QK_TST_KEPT_GOING", None),
        ("QK_TST_ANSWERED_ALL_PARTS", None),  # over the cap of 3
    ])
    kept = [e.quirk_id for e in Q.clean_question_quirks(q).earned_quirks]
    assert kept == ["QK_STR_CLEAR_SETUP", "QK_COM_NEAT_WORK", "QK_TST_KEPT_GOING"]


def test_blank_question_earns_nothing():
    q = _question(["TST_BLANK"], [("QK_TST_KEPT_GOING", None)], steps=[])
    assert Q.clean_question_quirks(q).earned_quirks == []


def test_collection_counts_once_per_upload():
    rows = Q.collection([
        ("2026-11-20T10:00:00Z", ["QK_TST_CHECKED_ANSWER", "QK_TST_CHECKED_ANSWER"]),
        ("2026-11-22T10:00:00Z", ["QK_TST_CHECKED_ANSWER", "QK_COM_UNITS_INCLUDED"]),
    ])
    by = {r["quirkId"]: r for r in rows}
    assert len(rows) == len(Q.QUIRKS)
    assert by["QK_TST_CHECKED_ANSWER"]["count"] == 2
    assert by["QK_TST_CHECKED_ANSWER"]["firstEarnedAt"] == "2026-11-20T10:00:00Z"
    assert by["QK_COM_UNITS_INCLUDED"]["count"] == 1
    assert by["QK_CON_BALANCED"]["count"] == 0 and by["QK_CON_BALANCED"]["firstEarnedAt"] is None


def test_quirks_json_ids_unique():
    raw = json.loads((ROOT / "backend" / "birdbrains" / "quirks.json").read_text())
    ids = [q["id"] for q in raw["quirks"]]
    assert len(ids) == len(set(ids)) == 24
