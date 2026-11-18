"""Grade real worksheet photos through the live API and save what the site said.

    python tools/grade_photos.py --url <api> --firebase-key <web API key> --batch-token <token> \
        --plan pro --out grades.json photo1.jpg photo2.jpg

Makes one throwaway student, uploads each photo as it is (the API blurs names), grades it, writes the
full grading JSON to --out, prints a short summary, then deletes the account and its data. Run it in
Cloud Shell (the API is not reachable from Claude's container). It never reads an answer key: compare
the output to the key afterwards.
"""
from __future__ import annotations

import argparse
import json
import secrets
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True)
    ap.add_argument("--firebase-key", required=True, help="public web API key")
    ap.add_argument("--batch-token", help="only needed for --plan pro")
    ap.add_argument("--plan", choices=["free", "pro"], default="pro")
    ap.add_argument("--course", default="MPM2D")
    ap.add_argument("--topic", default="Mixed review")
    ap.add_argument("--out", default="grades.json")
    ap.add_argument("photos", nargs="+")
    args = ap.parse_args()
    if args.plan == "pro" and not args.batch_token:
        ap.error("--plan pro needs --batch-token")

    r = httpx.post("https://identitytoolkit.googleapis.com/v1/accounts:signUp", params={"key": args.firebase_key},
                   json={"email": f"gradetest-{secrets.token_hex(6)}@example.com",
                         "password": secrets.token_urlsafe(18), "returnSecureToken": True}, timeout=30)
    r.raise_for_status()
    http = httpx.Client(base_url=args.url.rstrip("/"), headers={"Authorization": f"Bearer {r.json()['idToken']}"}, timeout=180)
    results: list[dict] = []
    try:
        me = http.post("/me", json={"role": "student", "name": "Grade Test", "course": args.course})
        me.raise_for_status()
        profile = me.json()
        sid = profile["studentId"]
        if args.plan == "pro":
            httpx.post(f"{args.url.rstrip('/')}/internal/users/{profile['uid']}/plan", json={"plan": "pro"},
                       headers={"X-Batch-Token": args.batch_token}, timeout=30).raise_for_status()
        for path in args.photos:
            with open(path, "rb") as f:
                up = http.post("/submissions", data={"studentId": sid, "course": args.course, "unitTopic": args.topic,
                                                     "sharpnessScore": "90"},
                               files=[("files", (path.rsplit("/", 1)[-1], f.read(), "image/jpeg"))])
            if up.status_code != 201:
                results.append({"photo": path, "error": f"upload HTTP {up.status_code}: {up.text[:300]}"})
                print(f"{path}: upload refused ({up.status_code}) {up.text[:200]}")
                continue
            g = http.post(f"/submissions/{up.json()['submissionId']}/process")
            body = g.json() if g.status_code == 200 else {"error": g.text[:300]}
            results.append({"photo": path, **body})
            grading = body.get("grading")
            if grading:
                print(f"{path}: {grading['totalScore']}/{grading['maxPossibleScore']}, "
                      f"{len(grading['stepDiagnostics'])} steps checked")
                for s in grading["stepDiagnostics"]:
                    if not s["isCorrect"]:
                        print(f"   step {s['stepNumber']} [{s.get('pillarImpacted')}] {s['studentInput'][:60]}")
                for e in grading["entityExtractions"]:
                    print(f"   code {e['misconceptionId']} ({e['severity']}): {e['description'][:80]}")
            else:
                print(f"{path}: {body.get('submission', {}).get('status', body)}")
    finally:
        print("cleanup:", http.delete("/me").status_code)
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
        print("saved", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
