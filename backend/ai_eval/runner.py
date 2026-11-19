"""Runs gold samples through a pipeline engine and writes the report."""
from __future__ import annotations

import json
import mimetypes
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from birdbrains.pipeline import ImageRef, Meter, PipelineEngine, SubmissionContext
from birdbrains.schemas import Stage1TranscriptionOutput
from birdbrains.taxonomy import ERROR_CODES

from .gold import GoldSample
from .metrics import PHASE2_EXACT_MATCH, SampleResult, Summary, consistency_problems, summarise


def typed_transcription(sample: GoldSample) -> Stage1TranscriptionOutput:
    n = len(sample.lines)
    lines = [{"line_number": i + 1, "raw_latex": text, "bounding_box_normalized": [0.05, i / n, 0.95, (i + 1) / n],
              "confidence_score": 1.0, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]}
             for i, text in enumerate(sample.lines)]
    return Stage1TranscriptionOutput.model_validate({
        "submission_id": sample.id, "overall_ocr_confidence": 1.0, "requires_hitl": False,
        "questions": [{"question_number": "1", "problem_statement": "", "lines": lines}],
        "lines": lines,
    })


def run_sample(engine: PipelineEngine, sample: GoldSample, plan: str) -> SampleResult:
    ctx = SubmissionContext(sample.id, sample.course, sample.unit_topic)
    meter = Meter()
    started = time.monotonic()
    result = SampleResult(sample=sample, seconds=0.0)
    try:
        if sample.images:
            images = [ImageRef(str(p), mimetypes.guess_type(p.name)[0] or "image/jpeg", p.read_bytes())
                      for p in sample.images]
            stage1 = engine.run_stage1(ctx, images, meter=meter)
        else:
            stage1 = typed_transcription(sample)
        if stage1.requires_hitl:
            result.needs_retake = True
            result.error = "page judged unreadable (retake)"
        else:
            result.stage2 = engine.run_stage2(ctx, stage1, plan=plan, meter=meter)
            problems = consistency_problems(result.stage2)
            if problems:
                result.error = "; ".join(problems)
    except Exception as exc:  # schema failures land here: the model's JSON did not validate
        result.error = f"{type(exc).__name__}: {str(exc)[:300]}"
    result.seconds = round(time.monotonic() - started, 3)
    result.usd = meter.usd
    return result


def run_all(engine: PipelineEngine, samples: list[GoldSample], plan: str, workers: int = 4) -> list[SampleResult]:
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(lambda s: run_sample(engine, s, plan), samples))


def _pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def markdown_report(summary: Summary, results: list[SampleResult], plan: str, model: str, gold_name: str) -> str:
    s = summary
    cf = "n/a (no carry-forward lines in this set)" if s.carry_forward_accuracy is None else \
        f"{_pct(s.carry_forward_accuracy)} of {s.carry_forward_lines} lines"
    out = [
        f"# BirdBrains accuracy report: {plan.capitalize()} plan",
        "",
        f"Run {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · gold set `{gold_name}` "
        f"({s.samples} samples) · engine `{model}`",
        "",
        "| Measure | Result | Gate |",
        "| --- | --- | --- |",
        f"| Schema pass rate | {_pct(s.schema_pass_rate)} | 100% |",
        f"| Pillar F1 | {s.pillar_f1:.3f} | 0.92 |",
        f"| Error-code F1 | {s.code_f1:.3f} | 0.88 |",
        f"| Carry-forward accuracy | {cf} | 95% |",
        f"| Samples graded exactly right | {_pct(s.exact_match_rate)} | {_pct(PHASE2_EXACT_MATCH)} (Phase 2) |",
        f"| Time per upload, P50 / P95 | {s.p50_seconds:.1f} s / {s.p95_seconds:.1f} s | P95 under 14 s |",
        f"| Cost per upload (mean) | ${s.mean_usd:.5f} | about $0.0045 |",
        f"| Sent for retake | {s.needs_retake} | |",
        "",
        "## Release gates",
        "",
    ]
    out += [f"- {'PASS' if ok else 'FAIL'}: {name}" for name, ok in s.gates().items()]
    out += ["", "## By error code", "", "| Code | Name | Expected | Found | Missed | Wrongly given |", "| --- | --- | --- | --- | --- | --- |"]
    for code, f in s.per_code.items():
        out.append(f"| {code} | {ERROR_CODES[code][0]} | {f.tp + f.fn} | {f.tp} | {f.fn} | {f.fp} |")
    wrong = [r for r in results if not r.exact]
    out += ["", f"## Samples to review ({len(wrong)})", ""]
    if not wrong:
        out.append("None. Every sample matched its label.")
    for r in wrong:
        want = ", ".join(sorted(r.sample.root_codes)) or "no errors"
        got = ", ".join(sorted(r.predicted_codes)) or "no errors"
        out.append(f"- **{r.sample.id}** ({r.sample.unit_topic}): label says {want}; the model said {got}."
                   + (f" Problem: {r.error}." if r.error else ""))
        if r.stage2:
            for e in r.stage2.identified_errors:
                if not e.is_cascading_consequence:
                    out.append(f"  - {e.error_code}: {e.description}")
    return "\n".join(out) + "\n"


def write_report(out_dir: str | Path, summary: Summary, results: list[SampleResult], plan: str, model: str,
                 gold_name: str) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    md = out_dir / f"accuracy-{plan}.md"
    js = out_dir / f"accuracy-{plan}.json"
    md.write_text(markdown_report(summary, results, plan, model, gold_name), encoding="utf-8")
    js.write_text(json.dumps({
        "plan": plan, "engine": model, "gold": gold_name, "samples": summary.samples,
        "schemaPassRate": summary.schema_pass_rate, "pillarF1": summary.pillar_f1, "codeF1": summary.code_f1,
        "exactMatchRate": summary.exact_match_rate, "carryForwardAccuracy": summary.carry_forward_accuracy,
        "p50Seconds": summary.p50_seconds, "p95Seconds": summary.p95_seconds, "meanUsd": summary.mean_usd,
        "gates": summary.gates(),
        "results": [{"id": r.sample.id, "expected": sorted(r.sample.root_codes), "predicted": sorted(r.predicted_codes),
                     "exact": r.exact, "seconds": r.seconds, "usd": round(r.usd, 6), "error": r.error}
                    for r in results],
    }, indent=1), encoding="utf-8")
    return md, js
