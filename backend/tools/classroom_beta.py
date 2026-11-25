#!/usr/bin/env python3
"""List, approve or decline Google Classroom beta requests.

Pro teachers sign up for the beta in the Teacher Hub with the Google email they use
for Classroom. Google only lets accounts listed as Test users connect until it has
verified the app (at most 100). For each request:

1. Cloud console > APIs & Services > OAuth consent screen > Test users > Add users:
   add the teacher's Google email.
2. Approve it here. The teacher's Connect button then works.

    TOKEN="$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
    python tools/classroom_beta.py --url https://<api> --batch-token "$TOKEN"                 # list pending
    python tools/classroom_beta.py --url https://<api> --batch-token "$TOKEN" --all           # everyone
    python tools/classroom_beta.py --url https://<api> --batch-token "$TOKEN" --approve teacher@gmail.com
    python tools/classroom_beta.py --url https://<api> --batch-token "$TOKEN" --decline teacher@gmail.com

Declining someone who was approved also disconnects their Classroom. Remove them
from Test users in the console too, to free the slot.
"""
from __future__ import annotations

import argparse
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True, help="API base URL")
    ap.add_argument("--batch-token", required=True)
    act = ap.add_mutually_exclusive_group()
    act.add_argument("--approve", metavar="EMAIL", help="approve this teacher's Google email")
    act.add_argument("--decline", metavar="EMAIL", help="decline (or remove) this teacher's Google email")
    act.add_argument("--all", action="store_true", help="list every request, not only pending ones")
    args = ap.parse_args()
    base, headers = args.url.rstrip("/"), {"X-Batch-Token": args.batch_token}

    if args.approve or args.decline:
        body = {"googleEmail": args.approve or args.decline, "status": "approved" if args.approve else "declined"}
        r = httpx.post(f"{base}/internal/classroom-beta", json=body, headers=headers, timeout=30)
        if r.status_code != 200:
            print(f"Failed ({r.status_code}): {r.text}", file=sys.stderr)
            return 1
        rec = r.json()
        print(f"{rec['name'] or rec['uid']} <{rec['googleEmail']}> is now {rec['status']}.")
        return 0

    r = httpx.get(f"{base}/internal/classroom-beta", params={} if args.all else {"status": "pending"},
                  headers=headers, timeout=30)
    if r.status_code != 200:
        print(f"Failed ({r.status_code}): {r.text}", file=sys.stderr)
        return 1
    rows = r.json()
    if not rows:
        print("No pending requests." if not args.all else "No requests yet.")
    for rec in rows:
        print(f"{rec['status']:9} {rec['requestedAt'][:10]}  {rec['googleEmail']:40} {rec.get('name', '')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
