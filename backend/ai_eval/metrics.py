"""Scoring. Everything here is plain arithmetic on results; no model calls."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from birdbrains.schemas import Stage2GradingAndAffectOutput

from .gold import GoldSample

# Release gates (launch plan, Dec 10) and the Phase 2 exit gate (Nov 24).
GATES = {"schema_pass_rate": 1.00, "pillar_f1": 0.92, "code_f1": 0.88, "carry_forward_accuracy": 0.95,
         "p95_seconds_max": 14.0}
PHASE2_EXACT_MATCH = 0.85


@dataclass
class SampleResult:
    sample: GoldSample
    seconds: float
    usd: float = 0.0
    stage2: Optional[Stage2GradingAndAffectOutput] = None
    error: str = ""  # set when the pipeline raised or the output broke a rule
    needs_retake: bool = False

    @property
    def predicted_codes(self) -> frozenset[str]:
        if not self.stage2:
            return frozenset()
        return frozenset(e.error_code for e in self.stage2.identified_errors if not e.is_cascading_consequence)

    @property
    def exact(self) -> bool:
        return not self.error and self.predicted_codes == self.sample.root_codes

    def carry_forward(self) -> tuple[int, int]:
        """(lines correctly left unpenalised, lines that should have been)."""
        want = self.sample.carry_forward_steps
        if not want:
            return 0, 0
        steps = {s.step_number: s for s in self.stage2.step_evaluations} if self.stage2 else {}
        ok = sum(1 for n in want if n in steps and steps[n].is_correct)
        return ok, len(want)


def consistency_problems(stage2: Stage2GradingAndAffectOutput) -> list[str]:
    """Rules the JSON schema cannot express."""
    problems = []
    for e in stage2.identified_errors:
        if not e.error_code.startswith(e.pillar.value):
            problems.append(f"{e.error_code} filed under pillar {e.pillar.value}")
    for s in stage2.step_evaluations:
        if s.error_code and s.pillar and not s.error_code.startswith(s.pillar.value):
            problems.append(f"step {s.step_number}: {s.error_code} filed under pillar {s.pillar.value}")
    pillars = sorted(p.pillar.value for p in stage2.pillar_scores)
    if pillars != ["CON", "FAC", "PRC", "TST"]:
        problems.append(f"pillar_scores has {pillars}, expected one each of CON, FAC, PRC, TST")
    for p in stage2.pillar_scores:
        if p.earned_score > p.max_score:
            problems.append(f"{p.pillar.value} score {p.earned_score} is above its maximum {p.max_score}")
    if not stage2.supportive_framing_message.strip():
        problems.append("no message to the student")
    return problems


@dataclass
class F1:
    tp: int = 0
    fp: int = 0
    fn: int = 0

    def add(self, expected: frozenset, predicted: frozenset) -> None:
        self.tp += len(expected & predicted)
        self.fp += len(predicted - expected)
        self.fn += len(expected - predicted)

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 1.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 1.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0


def percentile(values: list[float], q: float) -> float:
    """Nearest-rank percentile, so P95 of 20 runs is the slowest but one."""
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[max(math.ceil(q * len(ordered)) - 1, 0)]


@dataclass
class Summary:
    samples: int
    schema_pass_rate: float
    pillar_f1: float
    code_f1: float
    exact_match_rate: float
    carry_forward_accuracy: Optional[float]  # None when the set has no carry-forward lines
    carry_forward_lines: int
    p50_seconds: float
    p95_seconds: float
    mean_usd: float
    needs_retake: int
    per_code: dict[str, F1] = field(default_factory=dict)

    def gates(self) -> dict[str, bool]:
        cf = self.carry_forward_accuracy
        return {
            "Schema pass rate 100%": self.schema_pass_rate >= GATES["schema_pass_rate"],
            "Pillar F1 at least 0.92": self.pillar_f1 >= GATES["pillar_f1"],
            "Error-code F1 at least 0.88": self.code_f1 >= GATES["code_f1"],
            "Carry-forward accuracy at least 95%": cf is not None and cf >= GATES["carry_forward_accuracy"],
            "P95 under 14 s": self.p95_seconds < GATES["p95_seconds_max"],
        }


def summarise(results: list[SampleResult]) -> Summary:
    pillar, code = F1(), F1()
    per_code: dict[str, F1] = {}
    cf_ok = cf_total = 0
    for r in results:
        want, got = r.sample.root_codes, r.predicted_codes
        code.add(want, got)
        pillar.add(frozenset(c[:3] for c in want), frozenset(c[:3] for c in got))
        for c in want | got:
            per_code.setdefault(c, F1()).add(want & {c}, got & {c})
        ok, total = r.carry_forward()
        cf_ok, cf_total = cf_ok + ok, cf_total + total
    n = len(results) or 1
    times = [r.seconds for r in results]
    return Summary(
        samples=len(results),
        schema_pass_rate=sum(1 for r in results if not r.error) / n,
        pillar_f1=pillar.f1, code_f1=code.f1,
        exact_match_rate=sum(1 for r in results if r.exact) / n,
        carry_forward_accuracy=cf_ok / cf_total if cf_total else None, carry_forward_lines=cf_total,
        p50_seconds=percentile(times, 0.50), p95_seconds=percentile(times, 0.95),
        mean_usd=sum(r.usd for r in results) / n,
        needs_retake=sum(1 for r in results if r.needs_retake),
        per_code=dict(sorted(per_code.items())),
    )
