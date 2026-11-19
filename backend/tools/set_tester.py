#!/usr/bin/env python3
"""Turn a BirdBrains testing account on or off.

A testing account has no monthly upload cap, may send the same photo again to have
it graded again, and has every Pro feature. Sign up on the site first (student, or
a parent linked to a test student), then run this in Cloud Shell:

    python tools/set_tester.py --url https://<api> \\
      --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)" \\
      --email you@example.com            # add --off to turn it back off

Calls POST /internal/testers, which needs the batch token, so only someone with
access to the Google Cloud project can grant it.
"""
from __future__ import annotations

import argparse
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True, help="API base URL")
    ap.add_argument("--batch-token", required=True)
    who = ap.add_mutually_exclusive_group(required=True)
    who.add_argument("--email", help="the email the account signs in with")
    who.add_argument("--uid", help="the Firebase uid, if you have it instead")
    ap.add_argument("--off", action="store_true", help="make it a normal account again")
    args = ap.parse_args()

    body = {"tester": not args.off} | ({"email": args.email} if args.email else {"uid": args.uid})
    r = httpx.post(f"{args.url.rstrip('/')}/internal/testers", json=body,
                   headers={"X-Batch-Token": args.batch_token}, timeout=30)
    if r.status_code != 200:
        print(f"Failed ({r.status_code}): {r.text}", file=sys.stderr)
        return 1
    p = r.json()
    state = "now a testing account (no upload cap, repeat photos allowed, Pro features on)" if p["tester"] \
        else "a normal account again"
    print(f"{p['name']} ({p['role']}, uid {p['uid']}) is {state}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
