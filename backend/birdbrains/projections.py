"""Turn stored pipeline records into the JSON contracts the frontend consumes."""
from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Optional

from .schemas import (
    AffectStateEnum,
    ApiGrading,
    ApiParentSummary,
    ApiWorksheet,
    EQAOLevel,
    PillarEnum,
    Stage2GradingAndAffectOutput,
    StudentLedger,
    WorksheetContent,
)

# Ontario achievement levels: Level 1 50-59%, Level 2 60-69%, Level 3 70-79%
# (the provincial standard), Level 4 80-100%.
LEVEL_FLOORS = [(0.80, EQAOLevel.LEVEL_4), (0.70, EQAOLevel.LEVEL_3), (0.60, EQAOLevel.LEVEL_2)]
FRICTION_ALERT_STATES = {
    AffectStateEnum.HIGH_FRICTION_FRUSTRATION,
    AffectStateEnum.COGNITIVE_OVERLOAD_AVOIDANCE,
}
MAX_TRAJECTORY_WEEKS = 8
MAX_ALERTS = 5


def dominant_affect(stage2: Stage2GradingAndAffectOutput) -> AffectStateEnum:
    """The affect state of the entity the student had the most friction with."""
    if stage2.sentiment_entities:
        return max(stage2.sentiment_entities, key=lambda e: e.friction_intensity).affect_state
    if stage2.aggregate_valence >= 0.3:
        return AffectStateEnum.CONFIDENT_MASTERY
    if stage2.aggregate_valence <= -0.45:
        return AffectStateEnum.HIGH_FRICTION_FRUSTRATION
    return AffectStateEnum.PRODUCTIVE_STRUGGLE


def to_api_grading(record: dict) -> ApiGrading:
    stage2 = Stage2GradingAndAffectOutput.model_validate(record["stage2"])
    roots = [e for e in stage2.identified_errors if not e.is_cascading_consequence]
    per_pillar = Counter(e.pillar for e in roots)
    pro = record.get("plan", "pro") == "pro"  # gradings made before plans existed count as pro
    return ApiGrading(
        gradingId=record["gradingId"],
        submissionId=record["submissionId"],
        studentId=record["studentId"],
        topic=record["unitTopic"],
        totalScore=round(sum(min(p.earned_score, p.max_score) for p in stage2.pillar_scores), 2),
        maxPossibleScore=round(sum(p.max_score for p in stage2.pillar_scores), 2),
        affectState=dominant_affect(stage2) if pro else None,  # mood is a Pro feature
        supportiveFramingMessage=stage2.supportive_framing_message,
        pillarBreakdowns=[
            dict(pillar=p.pillar, maxScore=p.max_score, earnedScore=min(p.earned_score, p.max_score),
                 errorCount=per_pillar.get(p.pillar, 0), feedback=p.feedback)
            for p in stage2.pillar_scores
        ],
        stepDiagnostics=[
            dict(stepNumber=s.step_number, studentInput=s.student_latex, isCorrect=s.is_correct,
                 pillarImpacted=s.pillar, isCarryForwardProtected=s.is_carry_forward_consistent,
                 explanation=s.explanation)
            for s in stage2.step_evaluations
        ],
        entityExtractions=[
            dict(misconceptionId=e.error_code, description=e.description, severity=e.severity) for e in roots
        ],
        scaffoldingMode=record["scaffoldingMode"] if pro else None,
        gradedAt=record["gradedAt"],
        plan="pro" if pro else "free",
    )


def to_api_worksheet(record: dict) -> ApiWorksheet:
    content = WorksheetContent.model_validate(record["content"])
    return ApiWorksheet(
        worksheetId=record["worksheetId"],
        gradingId=record["gradingId"],
        title=content.title,
        targetConcept=content.target_concept,
        sectionA_DiagnosticMirror=[
            dict(originalStepText=m.original_step_text, annotatedCorrection=m.annotated_correction,
                 keyTakeaway=m.key_takeaway)
            for m in content.diagnostic_mirror
        ],
        sectionB_FadedScaffolding=[
            dict(stepNumber=s.step_number, prompt=s.prompt, scaffoldingType=s.scaffolding_type,
                 givenContent=s.given_content, blankPlaceholder=s.blank_placeholder, hint=s.hint)
            for s in content.faded_scaffolding
        ],
        sectionC_IndependentTransfer=dict(
            problemId=f"tp_{record['worksheetId'][4:]}",
            problemStatement=content.independent_transfer.problem_statement,
            targetPillarFocus=content.independent_transfer.target_pillar_focus,
            metacognitiveChecklist=content.independent_transfer.metacognitive_checklist,
        ),
    )


def eqao_forecast(ledger: StudentLedger) -> tuple[EQAOLevel, float]:
    """Level from the observation-weighted mean of strand masteries.

    Confidence is a heuristic, not a statistical interval: it grows with the
    number of graded submissions (up to 10) and with distance from the nearest
    level boundary, and is capped at 95.
    """
    counts = Counter(o.strand for o in ledger.history)
    total = sum(counts.values())
    overall = sum(ledger.mastery_by_strand[s] * n for s, n in counts.items()) / total
    level = next((lvl for floor, lvl in LEVEL_FLOORS if overall >= floor), EQAOLevel.LEVEL_1)
    margin = min(abs(overall - floor) for floor, _ in LEVEL_FLOORS)
    confidence = 50 + 3 * min(total, 10) + 150 * min(margin, 0.10)
    return level, round(min(confidence, 95.0), 0)


def _trajectories(ledger: StudentLedger) -> dict[str, list[dict]]:
    """End-of-week EWMA mastery per strand, weeks counted from the first submission."""
    if not ledger.history:
        return {}
    start = datetime.fromisoformat(ledger.history[0].observed_at)
    by_strand: dict[str, dict[int, float]] = {}
    for o in ledger.history:  # chronological, so later observations overwrite the week
        week = (datetime.fromisoformat(o.observed_at) - start).days // 7 + 1
        by_strand.setdefault(o.strand, {})[week] = o.mastery_after
    return {
        strand: [
            {"weekLabel": f"Wk {w}", "score": round(m * 100, 1)}
            for w, m in sorted(weeks.items())[-MAX_TRAJECTORY_WEEKS:]
        ]
        for strand, weeks in by_strand.items()
    }


def parent_summary(profile: dict, ledger: StudentLedger, gradings: list[dict],
                   include_affect: bool = True) -> Optional[ApiParentSummary]:
    """None when the student has no graded work yet. Friction alerts are a Pro
    feature: only shown when ``include_affect`` and only from Pro gradings."""
    if not ledger.history:
        return None
    level, confidence = eqao_forecast(ledger)
    trajectories = _trajectories(ledger)

    error_counts: Counter = Counter()
    alerts = []
    for g in sorted(gradings, key=lambda g: g["gradedAt"], reverse=True):
        stage2 = Stage2GradingAndAffectOutput.model_validate(g["stage2"])
        error_counts.update(e.pillar for e in stage2.identified_errors if not e.is_cascading_consequence)
        affect = dominant_affect(stage2)
        pro_grading = g.get("plan", "pro") == "pro"
        if (include_affect and pro_grading and affect in FRICTION_ALERT_STATES and stage2.parent_insight
                and len(alerts) < MAX_ALERTS):
            alerts.append(
                dict(detectedDate=g["gradedAt"][:10], frictionLevel=affect, topicContext=g["unitTopic"],
                     actionableParentInsight=stage2.parent_insight)
            )
    total_errors = sum(error_counts.values())
    distribution = [
        dict(pillar=p, percentageOfTotalErrors=round(100 * error_counts[p] / total_errors, 1))
        for p in sorted(PillarEnum, key=lambda p: -error_counts[p])
        if total_errors and error_counts[p]
    ]
    return ApiParentSummary(
        studentId=profile["studentId"],
        studentName=profile["name"],
        course=profile.get("course") or gradings[0]["course"],
        overallEqaoForecast=level,
        eqaoForecastConfidence=confidence,
        strandMasteries=[
            dict(strandName=s, currentEWMAMastery=round(m, 3), historicalTrajectory=trajectories.get(s, []))
            for s, m in ledger.mastery_by_strand.items()
        ],
        pillarErrorDistribution=distribution,
        cognitiveFrictionAlerts=alerts,
    )
