#!/usr/bin/env python3
"""List, set up or decline schools' Canvas and Brightspace for Quark.

A Pro teacher who presses Connect for Canvas or Brightspace types their school's
address. If that school is not set up yet, the request shows up here. To set one up,
the school's LMS admin registers Quark on their site (steps to send them are in
docs/LMS.md) and gives you a client ID and secret. Then:

    TOKEN="$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
    API=https://birdbrains-api-28737473918.northamerica-northeast1.run.app
    python tools/lms_schools.py --url $API --batch-token "$TOKEN"                     # waiting requests
    python tools/lms_schools.py --url $API --batch-token "$TOKEN" --all               # every school
    python tools/lms_schools.py --url $API --batch-token "$TOKEN" \\
        --add canvas https://school.instructure.com --name "Maple High"              # asks for ID + secret
    python tools/lms_schools.py --url $API --batch-token "$TOKEN" \\
        --decline brightspace https://board.brightspace.com                          # also disconnects teachers

The client secret is typed at a hidden prompt (never on the command line, so it is
not in your shell history) and is sealed by the API before it is stored.
"""
from __future__ import annotations

import argparse
import getpass
import sys

import httpx

PROVIDERS = ("canvas", "brightspace")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True, help="API base URL")
    ap.add_argument("--batch-token", required=True)
    act = ap.add_mutually_exclusive_group()
    act.add_argument("--add", nargs=2, metavar=("PROVIDER", "LMS_URL"), help="set a school up (or update its keys)")
    act.add_argument("--decline", nargs=2, metavar=("PROVIDER", "LMS_URL"), help="decline or turn a school off")
    act.add_argument("--all", action="store_true", help="list every school, not only waiting requests")
    ap.add_argument("--name", help="school name to show (with --add)")
    ap.add_argument("--unscoped", action="store_true",
                    help="Canvas only: the school's developer key does NOT have 'Enforce scopes' on")
    args = ap.parse_args()
    base, headers = args.url.rstrip("/"), {"X-Batch-Token": args.batch_token}

    if args.add or args.decline:
        provider, lms_url = args.add or args.decline
        if provider not in PROVIDERS:
            print(f"PROVIDER must be one of {', '.join(PROVIDERS)}", file=sys.stderr)
            return 2
        body: dict = {"provider": provider, "instanceUrl": lms_url,
                      "status": "active" if args.add else "declined", "scoped": not args.unscoped}
        if args.name:
            body["name"] = args.name
        if args.add:
            client_id = input("Client ID (Canvas: the developer key's ID number): ").strip()
            secret = getpass.getpass("Client secret (hidden; Enter to keep the stored one): ").strip()
            if client_id:
                body["clientId"] = client_id
            if secret:
                body["clientSecret"] = secret
        r = httpx.post(f"{base}/internal/lms-schools", json=body, headers=headers, timeout=30)
        if r.status_code != 200:
            print(f"Failed ({r.status_code}): {r.text}", file=sys.stderr)
            return 1
        rec = r.json()
        print(f"{rec.get('name') or rec['instanceUrl']} ({provider}) is now {rec['status']}.")
        for req in rec.get("requests", []):
            print(f"   asked by {req.get('name') or req['uid']} on {req['at'][:10]}")
        return 0

    r = httpx.get(f"{base}/internal/lms-schools", params={} if args.all else {"status": "requested"},
                  headers=headers, timeout=30)
    if r.status_code != 200:
        print(f"Failed ({r.status_code}): {r.text}", file=sys.stderr)
        return 1
    rows = r.json()
    if not rows:
        print("No waiting requests." if not args.all else "No schools yet.")
    for rec in rows:
        who = ", ".join(q.get("name") or q["uid"] for q in rec.get("requests", []))
        print(f"{rec['status']:9} {rec['provider']:11} {rec['instanceUrl']:45} {rec.get('name', '')}  {who}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
