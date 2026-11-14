"""Mastery & Affect Ledger: dual EWMA plus the scaffolding-mode state machine.

    mastery_t = a_M * score_t   + (1 - a_M) * mastery_{t-1}     a_M = 0.30 (per strand)
    valence_t = a_V * valence_t + (1 - a_V) * valence_{t-1}     a_V = 0.35 (per student)

The first observation seeds each average.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .schemas import (
    LedgerObservation,
    PillarEnum,
    ScaffoldingModeEnum,
    Stage2GradingAndAffectOutput,
    StudentLedger,
)

ALPHA_MASTERY = 0.30
ALPHA_VALENCE = 0.35

# Spec: valence at or below this puts the student in de-escalation.
DEESCALATION_VALENCE = -0.45
# The spec says "error frequency" drives the speed bump without giving numbers.
# These are our defaults: over the last few submissions, the student is making
# errors regularly and at least half of them are slips (FAC/TST), not gaps.
SPEED_BUMP_WINDOW = 3
SPEED_BUMP_MIN_ERRORS_PER_SUBMISSION = 1.0
SPEED_BUMP_MIN_SLIP_SHARE = 0.5

SLIP_PILLARS = {PillarEnum.FAC, PillarEnum.TST}


def ewma(previous: Optional[float], observation: float, alpha: float) -> float:
    if previous is None:
        return observation
    return alpha * observation + (1.0 - alpha) * previous


def score_fraction(stage2: Stage2GradingAndAffectOutput) -> float:
    max_total = sum(p.max_score for p in stage2.pillar_scores)
    if max_total > 0:
        earned = sum(min(p.earned_score, p.max_score) for p in stage2.pillar_scores)
        return max(0.0, min(1.0, earned / max_total))
    # No pillar scores: fall back to the share of steps that were not root errors.
    steps = stage2.step_evaluations
    if not steps:
        return 0.0
    return sum(1 for s in steps if s.is_correct) / len(steps)


def root_errors(stage2: Stage2GradingAndAffectOutput):
    return [e for e in stage2.identified_errors if not e.is_cascading_consequence]


def determine_scaffolding_mode(valence_ewma: float, history: list[LedgerObservation]) -> ScaffoldingModeEnum:
    if valence_ewma <= DEESCALATION_VALENCE:
        return ScaffoldingModeEnum.HIGH_SUPPORT_DEESCALATION
    recent = history[-SPEED_BUMP_WINDOW:]
    total = sum(o.root_error_count for o in recent)
    slips = sum(o.slip_error_count for o in recent)
    if (
        recent
        and total / len(recent) >= SPEED_BUMP_MIN_ERRORS_PER_SUBMISSION
        and slips / total >= SPEED_BUMP_MIN_SLIP_SHARE
    ):
        return ScaffoldingModeEnum.METACOGNITIVE_SPEED_BUMP
    return ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE


def apply_observation(
    ledger: StudentLedger,
    stage2: Stage2GradingAndAffectOutput,
    strand: str,
    observed_at: Optional[datetime] = None,
) -> StudentLedger:
    """Return a new ledger with this grading folded in. Re-applying a submission
    that is already in the history is a no-op, so retries are safe."""
    if any(o.submission_id == stage2.submission_id for o in ledger.history):
        return ledger
    observed_at = observed_at or datetime.now(timezone.utc)
    fraction = score_fraction(stage2)
    mastery = ewma(ledger.mastery_by_strand.get(strand), fraction, ALPHA_MASTERY)
    valence = ewma(ledger.valence_ewma, stage2.aggregate_valence, ALPHA_VALENCE)
    roots = root_errors(stage2)
    obs = LedgerObservation(
        submission_id=stage2.submission_id,
        observed_at=observed_at.isoformat(),
        strand=strand,
        score_fraction=fraction,
        valence=stage2.aggregate_valence,
        mastery_after=mastery,
        valence_after=valence,
        root_error_count=len(roots),
        slip_error_count=sum(1 for e in roots if e.pillar in SLIP_PILLARS),
    )
    history = [*ledger.history, obs]
    return StudentLedger(
        student_id=ledger.student_id,
        mastery_by_strand={**ledger.mastery_by_strand, strand: mastery},
        valence_ewma=valence,
        scaffolding_mode=determine_scaffolding_mode(valence, history),
        history=history,
    )
