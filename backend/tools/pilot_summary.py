#!/usr/bin/env python3
"""Daily pilot summary: what happened on BirdBrains in the last day(s), in plain text.

    python tools/pilot_summary.py --url https://<api> \\
      --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)" [--days 1]

Reads GET /internal/stats, which returns counts and error codes only (no names or ids).
"""
from __future__ import annotations

import argparse
import sys

import httpx

sys.path.insert(0, __file__.rsplit("/tools/", 1)[0])
from birdbrains.taxonomy import ERROR_CODES  # noqa: E402


def render(s: dict) -> str:
    def parts(d: dict) -> str:
        return ", ".join(f"{v} {k}" for k, v in sorted(d.items())) or "none"

    span = "24 hours" if s["days"] == 1 else f"{s['days']} days"
    cost = s["modelCostUsdByPlan"]
    total = sum(cost.values())
    lines = [
        f"BirdBrains pilot summary, last {span}",
        "",
        f"New accounts: {parts(s['newAccounts'])}",
        f"Uploads: {s['uploads']} from {s['activeStudents']} students ({parts(s['activeStudentsByPlan'])})",
        f"  by result: {parts(s['uploadsByStatus'])}",
        f"  by source: {parts(s['uploadsBySource'])}",
        f"Free students who hit the monthly cap: {s['freeStudentsAtCap']}",
        f"Graded: {s['graded']} ({parts(s['gradedByPlan'])}); {s['gradedWithNoErrors']} had no errors",
    ]
    if s["topErrorCodes"]:
        lines.append("Most common errors:")
        lines += [f"  {e['count']} x {e['code']} {ERROR_CODES.get(e['code'], ('?',))[0]}" for e in s["topErrorCodes"]]
    if s["graded"]:
        per = total / s["graded"]
        lines.append(f"Model cost: ${total:.2f} total, ${per:.4f} per graded upload ({', '.join(f'{k} ${v:.2f}' for k, v in sorted(cost.items()))})")
    if s["modelSecondsMedian"] is not None:
        lines.append(f"Model time per upload: median {s['modelSecondsMedian']:.1f} s, P95 {s['modelSecondsP95']:.1f} s (target under 14 s)")
    lines.append(f"Worksheets: {parts(s['worksheets'])}")
    failed = s["uploadsByStatus"].get("FAILED", 0)
    retake = s["uploadsByStatus"].get("NEEDS_RETAKE", 0)
    flags = []
    if failed:
        flags.append(f"{failed} upload(s) failed: check the Cloud Run logs")
    if s["uploads"] and retake / s["uploads"] > 0.2:
        flags.append(f"{retake} of {s['uploads']} uploads were sent back for a retake: photos may be hard to read")
    if s["modelSecondsP95"] and s["modelSecondsP95"] > 14:
        flags.append("P95 model time is over 14 s")
    lines += ["", "To look at: " + ("; ".join(flags) if flags else "nothing flagged")]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True)
    ap.add_argument("--batch-token", required=True)
    ap.add_argument("--days", type=int, default=1)
    args = ap.parse_args()
    r = httpx.get(args.url.rstrip("/") + "/internal/stats", params={"days": args.days},
                  headers={"X-Batch-Token": args.batch_token}, timeout=60)
    if r.status_code != 200:
        print(f"Could not read the stats: {r.status_code} {r.text[:200]}")
        return 1
    print(render(r.json()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
