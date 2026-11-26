"""Progress and class reports, built from stored gradings and the ledger.

Pure functions: the API routes fetch the records and check access, these turn
them into the report payloads. Mood data appears only for Pro students.
"""
from __future__ import annotations

from collections import Counter
from typing import Optional

from .mastery_affect_ledger import root_errors
from .quirks import tally as quirk_tally, upload_summary
from .schemas import (
    ApiCohortReport,
    ApiCohortStudent,
    ApiErrorCodeCount,
    ApiPillarErrorShare,
    ApiProgressPoint,
    ApiProgressReport,
    ApiStrandLevel,
    PillarEnum,
    Stage2GradingAndAffectOutput,
    StudentLedger,
)
from .taxonomy import ERROR_CODES

# A student is flagged for the teacher when their average mastery is below this,
# or when the same error code keeps coming back.
ATTENTION_MASTERY = 0.5


def _pillar_shares(counts: Counter) -> list[ApiPillarErrorShare]:
    total = sum(counts.values())
    return [ApiPillarErrorShare(pillar=p, percentageOfTotalErrors=round(100 * counts[p.value] / total, 1) if total else 0.0)
            for p in PillarEnum]


def _code_rows(count: Counter, last_seen: dict[str, str], students: Optional[Counter] = None) -> list[ApiErrorCodeCount]:
    return [ApiErrorCodeCount(code=c, name=ERROR_CODES[c][0], pillar=PillarEnum(c[:3]), count=n,
                              students=students[c] if students else 1, lastSeen=last_seen[c])
            for c, n in sorted(count.items(), key=lambda kv: (-kv[1], kv[0]))]


def progress_report(profile: dict, plan: str, ledger: Optional[StudentLedger], gradings: list[dict]) -> ApiProgressReport:
    pro = plan == "pro"
    count: Counter = Counter()
    appearances: Counter = Counter()  # uploads on which each code was given
    last_seen: dict[str, str] = {}
    quirk_uploads: list = []
    for g in sorted(gradings, key=lambda g: g["gradedAt"]):
        stage2 = Stage2GradingAndAffectOutput.model_validate(g["stage2"])
        quirk_uploads.append((g["gradedAt"], *upload_summary(stage2.question_analyses)))
        codes = [e.error_code for e in root_errors(stage2)]
        count.update(codes)
        appearances.update(set(codes))
        last_seen.update({c: g["gradedAt"] for c in codes})
    mastery = ledger.mastery_by_strand if ledger else {}
    dates = sorted(g["gradedAt"] for g in gradings)
    return ApiProgressReport(
        studentId=profile["studentId"], studentName=profile["name"], course=profile["course"], plan=plan,
        uploads=len(gradings), firstUploadAt=dates[0] if dates else None, lastUploadAt=dates[-1] if dates else None,
        averageMastery=round(sum(mastery.values()) / len(mastery), 3) if mastery else None,
        masteryByStrand=[ApiStrandLevel(strandName=s, mastery=round(m, 3)) for s, m in sorted(mastery.items())],
        timeline=[ApiProgressPoint(date=o.observed_at, strand=o.strand, scoreFraction=round(o.score_fraction, 3),
                                   masteryAfter=round(o.mastery_after, 3), rootErrors=o.root_error_count,
                                   valence=round(o.valence_after, 3) if pro else None)
                  for o in (ledger.history if ledger else [])],
        errorCodes=_code_rows(count, last_seen),
        recurringCodes=sorted(c for c, n in appearances.items() if n >= 2),
        pillarErrorDistribution=_pillar_shares(Counter({p.value: sum(n for c, n in count.items() if c.startswith(p.value))
                                                        for p in PillarEnum})),
        pillarTallies=quirk_tally(quirk_uploads),
    )


def cohort_report(reports: list[ApiProgressReport], google_course_id: Optional[str] = None) -> ApiCohortReport:
    count: Counter = Counter()
    students: Counter = Counter()
    last_seen: dict[str, str] = {}
    strands: dict[str, list[float]] = {}
    rows = []
    for r in reports:
        for e in r.errorCodes:
            count[e.code] += e.count
            students[e.code] += 1
            last_seen[e.code] = max(last_seen.get(e.code, ""), e.lastSeen)
        for s in r.masteryByStrand:
            strands.setdefault(s.strandName, []).append(s.mastery)
        low = r.averageMastery is not None and r.averageMastery < ATTENTION_MASTERY
        rows.append(ApiCohortStudent(
            studentId=r.studentId, studentName=r.studentName, uploads=r.uploads, lastUploadAt=r.lastUploadAt,
            averageMastery=r.averageMastery, topCode=r.errorCodes[0].code if r.errorCodes else None,
            recurringCodes=r.recurringCodes, needsAttention=low or bool(r.recurringCodes)))
    return ApiCohortReport(
        googleCourseId=google_course_id,
        students=sorted(rows, key=lambda s: (not s.needsAttention, s.studentName)),
        uploads=sum(r.uploads for r in reports),
        masteryByStrand=[ApiStrandLevel(strandName=s, mastery=round(sum(v) / len(v), 3)) for s, v in sorted(strands.items())],
        errorCodes=_code_rows(count, last_seen, students),
        pillarErrorDistribution=_pillar_shares(Counter({p.value: sum(n for c, n in count.items() if c.startswith(p.value))
                                                        for p in PillarEnum})),
    )
