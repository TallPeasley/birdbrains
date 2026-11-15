#!/usr/bin/env python3
"""Load test E2E-02: N uploads at once must all be graded within the time limit.

    python tools/load_test.py --url https://<api> --token <sign-in token> --student-id stu_...

The account must be on Pro (Free stops at its monthly cap). Use a test account:
every run adds N graded uploads to it. The sign-in token is the Firebase ID token
of that account (in the site's browser console: copy it from any request's
Authorization header, without the word "Bearer"). Locally, with the dev backend,
it is "dev:<uid>". Each upload is a different generated page, so the duplicate
check does not fire.
"""
from __future__ import annotations

import argparse
import io
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
from PIL import Image, ImageDraw


def page(n: int, base: Image.Image | None) -> bytes:
    img = base.copy() if base else Image.new("RGB", (1600, 1200), "white")
    draw = ImageDraw.Draw(img)
    stamp = f"{time.time_ns()}-{n}"
    for i, ch in enumerate(stamp):  # a strip of grey blocks unique to this upload
        v = (ord(ch) * 37) % 200
        draw.rectangle((20 + 24 * i, 20, 40 + 24 * i, 40), fill=(v, v, v))
    for i in range(6):
        draw.line((120, 200 + 120 * i, 1300, 200 + 120 * i + (n % 7)), fill="black", width=4)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def one(args, n: int, base) -> tuple[float, str]:
    headers = {"Authorization": f"Bearer {args.token}"}
    started = time.monotonic()
    try:
        with httpx.Client(base_url=args.url, headers=headers, timeout=args.limit + 30) as c:
            r = c.post("/submissions", data={"studentId": args.student_id, "course": args.course,
                                             "unitTopic": "Load test", "sharpnessScore": "90"},
                       files=[("files", (f"load-{n}.jpg", page(n, base), "image/jpeg"))])
            if r.status_code != 201:
                return time.monotonic() - started, f"upload {r.status_code}: {r.text[:120]}"
            r = c.post(f"/submissions/{r.json()['submissionId']}/process")
            if r.status_code != 200:
                return time.monotonic() - started, f"grading {r.status_code}: {r.text[:120]}"
            status = r.json()["submission"]["status"]
            return time.monotonic() - started, "" if status in ("GRADED", "NEEDS_RETAKE") else f"status {status}"
    except Exception as exc:
        return time.monotonic() - started, f"{type(exc).__name__}: {exc}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True)
    ap.add_argument("--token", required=True)
    ap.add_argument("--student-id", required=True)
    ap.add_argument("--course", default="MPM2D")
    ap.add_argument("-n", type=int, default=30, help="uploads at once (default 30)")
    ap.add_argument("--limit", type=float, default=45.0, help="seconds all of them must finish within")
    ap.add_argument("--photo", help="a real worksheet photo to use as the page (optional)")
    args = ap.parse_args()
    base = Image.open(args.photo).convert("RGB") if args.photo else None

    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.n) as pool:
        results = list(pool.map(lambda n: one(args, n, base), range(args.n)))
    wall = time.monotonic() - started
    times = sorted(t for t, _ in results)
    failures = [e for _, e in results if e]
    p95 = times[max(-(-95 * len(times) // 100) - 1, 0)]
    print(f"{args.n} uploads at once: all done in {wall:.1f} s · median {times[len(times) // 2]:.1f} s · "
          f"P95 {p95:.1f} s · slowest {times[-1]:.1f} s · failed {len(failures)}")
    for e in sorted(set(failures)):
        print(f"  {failures.count(e)} x {e}")
    ok = not failures and wall <= args.limit
    print(("PASS" if ok else "FAIL") + f": E2E-02 needs every upload graded within {args.limit:.0f} s")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
