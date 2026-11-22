"""Check the nightly worksheet generator against real Vertex AI, end to end.

    cd backend
    python -m tools.worksheet_check --out wscheck            # grade + write worksheets now
    python -m tools.worksheet_check --out wscheck --batch    # also start a real Batch API job
    python -m tools.worksheet_check --out wscheck --collect  # read that job when it is done

Uses the gold set (ai_eval/gold): the two real photos (BB-W11, BB-W12) go through
Stage 1 and Stage 2, and a few typed samples through Stage 2 only, all on Pro
settings. Each flagged grading then gets its worksheet from the same request the
nightly job sends (same prompt, schema and settings), called directly so the result
is back in seconds. Every worksheet is validated and linted exactly as the nightly
collect does, and written to <out>/worksheets.md for a tutor to read.

--batch sends the same requests as one real Batch API job (through the project's
bucket, like the nightly run) and saves the job record in <out>/job.json. --collect
reads it back, shows what the raw output lines look like, and parses them with the
nightly code. Nothing is written to Firestore and no student account is touched.

Needs Google credentials for the project (gcloud auth application-default login)
and GOOGLE_CLOUD_PROJECT. Costs a few cents per run.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from ai_eval.gold import GoldSample, load_gold
from ai_eval.runner import typed_transcription
from birdbrains import batch_engine as B
from birdbrains.math_lint import lint_worksheet, tidy_worksheet
from birdbrains.worksheet_maths import maths_report
from birdbrains.pipeline import GeminiPipeline, ImageRef, Meter, SubmissionContext, configure_tracing
from birdbrains.questions import segment_questions
from birdbrains.known_worksheets import apply_known_worksheet
from birdbrains.schemas import CourseEnum, ScaffoldingModeEnum, Stage2GradingAndAffectOutput, WorksheetContent

GOLD = Path(__file__).resolve().parent.parent / "ai_eval" / "gold" / "synthetic.jsonl"


def grade(pipe: GeminiPipeline, sample, meter: Meter):
    ctx = SubmissionContext(sample.id, sample.course, sample.unit_topic)
    if sample.images:
        images = [ImageRef(str(p), "image/jpeg", p.read_bytes()) for p in sample.images]
        stage1 = pipe.run_stage1(ctx, images, meter=meter)
        stage1 = apply_known_worksheet(segment_questions(stage1))
    else:
        stage1 = typed_transcription(sample)
    return pipe.run_stage2(ctx, stage1, plan="pro", meter=meter)


def direct_worksheet(client, item: B.FlaggedGrading) -> tuple[dict, float]:
    """One worksheet request, sent directly instead of through a batch job. Returns an
    output line shaped like a batch output line, so the nightly parser reads it."""
    from google.genai import types

    body = json.loads(B.build_jsonl([item]))["request"]
    gen = body["generationConfig"]
    started = time.monotonic()
    response = client.models.generate_content(
        model=B.WORKSHEET_MODEL,
        contents=body["contents"][0]["parts"][0]["text"],
        config=types.GenerateContentConfig(
            system_instruction=B.WORKSHEET_SYSTEM,
            temperature=gen["temperature"],
            response_mime_type=gen["responseMimeType"],
            response_json_schema=gen["responseJsonSchema"],
        ),
    )
    return {"grading_id": item.grading_id, "response": {"candidates": [
        {"content": {"parts": [{"text": response.text or ""}]}}]}}, time.monotonic() - started


def worksheet_markdown(gid: str, ws: WorksheetContent) -> str:
    out = [f"## {gid}: {ws.title}", f"Target concept: {ws.target_concept}", "", "### A. Diagnostic mirror"]
    for m in ws.diagnostic_mirror:
        out += [f"- before: `{m.previous_step_text}`", f"- student: `{m.original_step_text}`",
                f"  - wrong part `{m.wrong_part}` -> `{m.correct_part}`", f"  - why: {m.what_went_wrong}",
                f"  - fix: `{m.annotated_correction}`", f"  - takeaway: {m.key_takeaway}"]
    out += ["", "### B. Faded scaffolding"]
    for s in ws.faded_scaffolding:
        out += [f"{s.step_number}. [{s.scaffolding_type}] {s.prompt}", f"   `{s.given_content}`"
                + (f" (answer: `{s.blank_placeholder}`)" if s.blank_placeholder else ""), f"   hint: {s.hint}"]
    t = ws.independent_transfer
    out += ["", "### C. Independent transfer", t.problem_statement, f"Pillar: {t.target_pillar_focus.value}"]
    out += [f"- [ ] {c}" for c in t.metacognitive_checklist]
    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default="wscheck")
    ap.add_argument("--samples", default="photos,S-02,S-05,S-09,S-14",
                    help="comma list of gold ids; 'photos' means every photo sample")
    ap.add_argument("--batch", action="store_true", help="also start a real Batch API job")
    ap.add_argument("--collect", action="store_true", help="read the job saved by --batch")
    ap.add_argument("--bucket", default=os.environ.get("BIRDBRAINS_BUCKET"),
                    help="defaults to <project>-birdbrains")
    args = ap.parse_args()
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        ap.error("set GOOGLE_CLOUD_PROJECT")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    bucket = args.bucket or f"{project}-birdbrains"

    if args.collect:
        from birdbrains.storage import GcsStorage

        job = json.loads((out / "job.json").read_text())
        storage = GcsStorage(bucket, project)
        engine = B.GeminiBatchEngine(storage, project)
        state = engine._client.batches.get(name=job["name"]).state
        print("job state:", getattr(state, "name", state))
        texts = storage.read_texts(job["outputPrefix"], ".jsonl")
        for text in texts[:1]:
            first = json.loads(text.splitlines()[0])
            print("raw output line keys:", sorted(first), "| has grading_id:", "grading_id" in first)
        result = engine.collect(job)
        if result is None:
            print("still running; try again later")
            return 0
        done, failed = result
        print(f"batch parsed: {len(done)} worksheets ready, {len(failed)} failed: {failed}")
        (out / "batch-worksheets.md").write_text("\n".join(worksheet_markdown(g, w) for g, w in done.items()))
        return 0 if done and not failed else 1

    configure_tracing()
    pipe = GeminiPipeline(project)
    photos = [GoldSample(id=p.stem.upper(), course=CourseEnum.MPM2D, unit_topic="", root_codes=frozenset(),
                         images=(p,)) for p in sorted(GOLD.parent.glob("*.jpg"))]
    samples = photos + load_gold(GOLD)
    wanted = set(args.samples.split(","))
    samples = [s for s in samples if s.id in wanted or ("photos" in wanted and s.images)]
    items, report, md = [], [], ["# Worksheet check\n"]
    for s in samples:
        meter = Meter()
        try:
            s2 = grade(pipe, s, meter)
        except Exception as exc:
            report.append({"sample": s.id, "stage": "grading", "error": f"{type(exc).__name__}: {exc}"[:400]})
            print(f"{s.id}: grading failed: {exc}")
            continue
        if not B.is_flagged(s2):
            report.append({"sample": s.id, "flagged": False})
            print(f"{s.id}: no root-cause error, no worksheet needed")
            continue
        item = B.FlaggedGrading(f"grd_{s.id}", s.course, s.unit_topic,
                                ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE, s2)
        items.append(item)
        row, secs = direct_worksheet(pipe._client, item)
        raw = row["response"]["candidates"][0]["content"]["parts"][0]["text"]
        entry = {"sample": s.id, "flagged": True, "worksheetSeconds": round(secs, 1),
                 "gradingUsd": round(meter.usd, 4)}
        try:
            ws = tidy_worksheet(WorksheetContent.model_validate_json(raw))
            entry["lint"] = lint_worksheet(ws)
            problems, read, steps = maths_report(ws)
            entry["mathsCheck"] = problems
            entry["mathsStepsRead"] = f"{read} of {steps}"
            md.append(worksheet_markdown(item.grading_id, ws))
        except Exception as exc:
            entry["schemaError"] = str(exc)[:400]
        done, failed = B.parse_output_jsonl(json.dumps(row))
        entry["nightlyWouldShowIt"] = item.grading_id in done
        report.append(entry)
        (out / f"{item.grading_id}.raw.json").write_text(raw)
        (out / f"{item.grading_id}.stage2.json").write_text(s2.model_dump_json(indent=1))
        print(json.dumps(entry))
    (out / "report.json").write_text(json.dumps(report, indent=1))
    (out / "worksheets.md").write_text("\n".join(md))
    ok = sum(1 for r in report if r.get("nightlyWouldShowIt"))
    flagged = sum(1 for r in report if r.get("flagged"))
    print(f"\n{ok} of {flagged} flagged samples got a worksheet that passes the nightly checks. See {out}/")

    if args.batch and items:
        from birdbrains.storage import GcsStorage

        engine = B.GeminiBatchEngine(GcsStorage(bucket, project), project)
        job = engine.submit(items)
        (out / "job.json").write_text(json.dumps(job, indent=1))
        print("batch job started:", job["name"], "- run again with --collect once it finishes")
    return 0 if flagged and ok == flagged else 1


if __name__ == "__main__":
    sys.exit(main())
