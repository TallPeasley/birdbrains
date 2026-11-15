"""python -m ai_eval --gold ai_eval/gold/synthetic.jsonl --engine gemini --plan pro"""
from __future__ import annotations

import argparse
import sys

from .gold import load_gold
from .metrics import summarise
from .runner import run_all, write_report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ai_eval", description="Run the gold set through the grading pipeline.")
    ap.add_argument("--gold", action="append", required=True, help="gold .jsonl file (repeat for several)")
    ap.add_argument("--engine", choices=["fake", "gemini"], default="fake")
    ap.add_argument("--plan", choices=["pro", "free", "both"], default="both")
    ap.add_argument("--out", default="ai_eval/reports")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, help="only the first N samples")
    ap.add_argument("--strict", action="store_true", help="exit 1 when a release gate fails")
    args = ap.parse_args(argv)

    samples = [s for path in args.gold for s in load_gold(path)][: args.limit]
    if args.engine == "gemini":
        from birdbrains.pipeline import GeminiPipeline, configure_tracing

        configure_tracing()
        engine = GeminiPipeline()
    else:
        from birdbrains.fake import FakePipeline

        engine = FakePipeline()

    passed = True
    for plan in (["pro", "free"] if args.plan == "both" else [args.plan]):
        results = run_all(engine, samples, plan, args.workers)
        summary = summarise(results)
        md, _ = write_report(args.out, summary, results, plan, args.engine, ", ".join(args.gold))
        print(f"[{plan}] {summary.samples} samples · schema {summary.schema_pass_rate:.0%} · pillar F1 "
              f"{summary.pillar_f1:.3f} · code F1 {summary.code_f1:.3f} · exact {summary.exact_match_rate:.0%} · "
              f"P95 {summary.p95_seconds:.1f}s · ${summary.mean_usd:.5f}/upload · report {md}")
        passed &= all(summary.gates().values())
    return 0 if passed or not args.strict else 1


if __name__ == "__main__":
    sys.exit(main())
