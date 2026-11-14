from datetime import datetime, timedelta, timezone

import pytest

from birdbrains import mastery_affect_ledger as L
from birdbrains.fake import FakePipeline
from birdbrains.pipeline import SubmissionContext
from birdbrains.projections import eqao_forecast, parent_summary
from birdbrains.schemas import CourseEnum, PillarEnum, ScaffoldingModeEnum, StudentLedger

SID = "stu_alexmercer99"


def grading(sub_id, valence=-0.3, earned_prc=1.5, pillar="PRC"):
    ctx = SubmissionContext(sub_id, CourseEnum.MPM2D, "Completing the Square")
    fp = FakePipeline()
    s2 = fp.run_stage2(ctx, fp.run_stage1(ctx, []))
    s2.aggregate_valence = valence
    s2.pillar_scores[1].earned_score = earned_prc
    for e in s2.identified_errors:
        e.pillar = PillarEnum(pillar)
    return s2


def test_ewma_math():
    assert L.ewma(None, 0.8, 0.3) == 0.8
    assert L.ewma(0.8, 0.5, L.ALPHA_MASTERY) == pytest.approx(0.3 * 0.5 + 0.7 * 0.8)
    assert L.ewma(-0.3, -1.0, L.ALPHA_VALENCE) == pytest.approx(0.35 * -1.0 + 0.65 * -0.3)


def test_dual_ewma_and_idempotence():
    ledger = StudentLedger(student_id=SID)
    ledger = L.apply_observation(ledger, grading("sub_1"), "Quadratic Relations")
    assert ledger.mastery_by_strand["Quadratic Relations"] == pytest.approx(0.8)
    assert ledger.valence_ewma == pytest.approx(-0.3)
    ledger = L.apply_observation(ledger, grading("sub_2", valence=-1.0, earned_prc=0), "Quadratic Relations")
    assert ledger.mastery_by_strand["Quadratic Relations"] == pytest.approx(0.3 * 0.65 + 0.7 * 0.8)
    assert ledger.valence_ewma == pytest.approx(0.35 * -1.0 + 0.65 * -0.3)
    assert L.apply_observation(ledger, grading("sub_2"), "Quadratic Relations") is ledger


def test_state_machine():
    ledger = StudentLedger(student_id=SID)
    ledger = L.apply_observation(ledger, grading("sub_1", valence=0.2), "Quadratic Relations")
    assert ledger.scaffolding_mode is ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE  # PRC error is not a slip
    ledger = L.apply_observation(ledger, grading("sub_2", valence=-1.0), "Quadratic Relations")
    assert ledger.valence_ewma > L.DEESCALATION_VALENCE
    ledger = L.apply_observation(ledger, grading("sub_3", valence=-1.0), "Quadratic Relations")
    assert ledger.valence_ewma <= L.DEESCALATION_VALENCE
    assert ledger.scaffolding_mode is ScaffoldingModeEnum.HIGH_SUPPORT_DEESCALATION

    slips = StudentLedger(student_id=SID)
    slips = L.apply_observation(slips, grading("sub_1", valence=0.4, pillar="FAC"), "Quadratic Relations")
    assert slips.scaffolding_mode is ScaffoldingModeEnum.METACOGNITIVE_SPEED_BUMP


def test_parent_summary_trajectory_and_forecast():
    ledger = StudentLedger(student_id=SID)
    start = datetime(2026, 9, 7, tzinfo=timezone.utc)
    gradings = []
    for week, earned in enumerate([0.0, 1.5, 3.0]):
        s2 = grading(f"sub_{week}", earned_prc=earned)
        when = start + timedelta(days=7 * week)
        ledger = L.apply_observation(ledger, s2, "Quadratic Relations", when)
        gradings.append({"gradedAt": when.isoformat(), "unitTopic": "Completing the Square",
                         "course": "MPM2D", "stage2": s2.model_dump(mode="json")})
    summary = parent_summary({"studentId": SID, "name": "Alex Mercer", "course": "MPM2D"}, ledger, gradings)
    traj = summary.strandMasteries[0].historicalTrajectory
    assert [p.weekLabel for p in traj] == ["Wk 1", "Wk 2", "Wk 3"]
    assert traj[0].score == 65.0 and traj[-1].score > traj[0].score
    level, confidence = eqao_forecast(ledger)
    assert level.value == "LEVEL_3" and 50 <= confidence <= 95
    assert len(summary.cognitiveFrictionAlerts) == 3
    assert parent_summary({"studentId": SID, "name": "x"}, StudentLedger(student_id=SID), []) is None
