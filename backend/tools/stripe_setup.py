#!/usr/bin/env python3
"""Set up Stripe for Quark (formerly BirdBrains) in one go, sandbox first, then live.

Run it on a computer that has ``gcloud`` signed in to the BirdBrains project
(Maalik's PC, or Cloud Shell), from the ``backend`` folder:

    python tools/stripe_setup.py --project birdbrain-514606 --price 12.99

It asks for the Stripe secret key without showing it (or reads STRIPE_SECRET_KEY),
then, in whichever mode that key belongs to (sandbox ``sk_test_`` or live ``sk_live_``):

1. finds or creates the product "Quark Pro" (renaming an old "BirdBrains Pro") and its monthly CAD price
   (lookup key ``birdbrains_pro_monthly``; a different amount makes a new price and
   moves the lookup key to it, existing subscribers keep their old price),
2. creates the customer portal settings (change card, invoices, cancel at period end),
3. points a webhook endpoint at ``<API URL>/billing/webhook`` with the events the API
   reads. An old endpoint at that URL is replaced, because Stripe shows a signing
   secret only once, when the endpoint is made,
4. writes the key, webhook signing secret, price id and portal settings id to Secret
   Manager (new versions if they exist).

Nothing is printed except ids. Then redeploy the API (``./deploy.sh``) so it reads them.
Run it again with the live key before launch.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from decimal import Decimal

API = "https://api.stripe.com/v1"
STRIPE_VERSION = "2025-03-31.basil"  # keep in step with birdbrains/billing.py
LOOKUP_KEY = "birdbrains_pro_monthly"  # internal id, kept after the Quark rename
PRODUCT_NAME = "Quark Pro"
REGION = "northamerica-northeast1"
DEFAULT_API_URL = "https://birdbrains-api-28737473918.northamerica-northeast1.run.app"
DEFAULT_SITE_URL = "https://birdbrain-514606.web.app"
EVENTS = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]


class Stripe:
    def __init__(self, key: str) -> None:
        self.key = key

    def call(self, method: str, path: str, fields: list[tuple[str, str]] | None = None) -> dict:
        headers = {"Authorization": f"Bearer {self.key}", "Stripe-Version": STRIPE_VERSION}
        data = None
        url = f"{API}{path}"
        if method == "POST":
            data = urllib.parse.urlencode(fields or []).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            headers["Idempotency-Key"] = str(uuid.uuid4())
        elif fields:
            url += "?" + urllib.parse.urlencode(fields)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=headers),
                                        timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            msg = json.load(e).get("error", {}).get("message", "")
            sys.exit(f"Stripe {method} {path} failed ({e.code}): {msg}")


def gcloud() -> str:
    exe = shutil.which("gcloud") or shutil.which("gcloud.cmd")
    if not exe:
        sys.exit("gcloud is not installed or not on PATH.")
    return exe


def put_secret(project: str, name: str, value: str) -> None:
    g = gcloud()
    exists = subprocess.run([g, "secrets", "describe", name, "--project", project],
                            capture_output=True).returncode == 0
    cmd = ([g, "secrets", "versions", "add", name, "--data-file=-", "--project", project] if exists else
           [g, "secrets", "create", name, "--data-file=-", "--project", project,
            "--replication-policy=user-managed", f"--locations={REGION}"])
    done = subprocess.run(cmd, input=value.encode(), capture_output=True)
    if done.returncode:
        sys.exit(f"Could not save secret {name}: {done.stderr.decode().strip()}")
    print(f"   secret {name}: {'new version' if exists else 'created'}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default="birdbrain-514606")
    ap.add_argument("--price", required=True, help="Pro price per month in CAD, e.g. 12.99")
    ap.add_argument("--api-url", default=DEFAULT_API_URL)
    ap.add_argument("--site-url", default=DEFAULT_SITE_URL)
    ap.add_argument("--dry-run", action="store_true", help="Set up Stripe but do not write Secret Manager")
    args = ap.parse_args()

    key = os.environ.get("STRIPE_SECRET_KEY") or getpass.getpass("Stripe secret key (sk_test_... or sk_live_...): ")
    key = key.strip()
    if not key.startswith(("sk_test_", "sk_live_", "rk_test_", "rk_live_")):
        sys.exit("That does not look like a Stripe secret key (it should start with sk_test_ or sk_live_).")
    mode = "LIVE" if "_live_" in key else "sandbox"
    cents = int((Decimal(args.price) * 100).to_integral_value())
    s = Stripe(key)
    print(f"== Stripe {mode}")

    # 1. Product and price
    found = s.call("GET", "/prices", [("lookup_keys[]", LOOKUP_KEY), ("active", "true"), ("expand[]", "data.product")])
    price = next((p for p in found.get("data", []) if p.get("unit_amount") == cents and p.get("currency") == "cad"), None)
    if price:
        product_id = price["product"]["id"]
        print(f"   price {price['id']}: already there (${cents / 100:.2f} CAD / month)")
        if price["product"].get("name") != PRODUCT_NAME:
            # The app was renamed (BirdBrains -> Quark): rename the existing product
            # so checkout, receipts and the billing portal show the new name.
            s.call("POST", f"/products/{product_id}", [("name", PRODUCT_NAME)])
            print(f"   product {product_id}: renamed to {PRODUCT_NAME}")
    else:
        old = found.get("data", [])
        if old:
            product_id = old[0]["product"]["id"]
            if old[0]["product"].get("name") != PRODUCT_NAME:
                s.call("POST", f"/products/{product_id}", [("name", PRODUCT_NAME)])
                print(f"   product {product_id}: renamed to {PRODUCT_NAME}")
        else:
            product_id = s.call("POST", "/products", [
                ("name", PRODUCT_NAME),
                ("description", "Unlimited uploads, mood and friction insights, and practice worksheets."),
            ])["id"]
            print(f"   product {product_id}: created")
        price = s.call("POST", "/prices", [
            ("product", product_id), ("currency", "cad"), ("unit_amount", str(cents)),
            ("recurring[interval]", "month"), ("lookup_key", LOOKUP_KEY), ("transfer_lookup_key", "true"),
        ])
        print(f"   price {price['id']}: created (${cents / 100:.2f} CAD / month)")

    # 2. Customer portal
    portal = s.call("POST", "/billing_portal/configurations", [
        ("business_profile[headline]", f"Manage your {PRODUCT_NAME} plan"),
        ("default_return_url", f"{args.site_url}/account"),
        ("features[payment_method_update][enabled]", "true"),
        ("features[invoice_history][enabled]", "true"),
        ("features[customer_update][enabled]", "true"),
        ("features[customer_update][allowed_updates][]", "email"),
        ("features[customer_update][allowed_updates][]", "address"),
        ("features[subscription_cancel][enabled]", "true"),
        ("features[subscription_cancel][mode]", "at_period_end"),
    ])
    print(f"   portal settings {portal['id']}: created")

    # 3. Webhook endpoint
    hook_url = f"{args.api_url.rstrip('/')}/billing/webhook"
    for ep in s.call("GET", "/webhook_endpoints", [("limit", "100")]).get("data", []):
        if ep.get("url") == hook_url:
            s.call("DELETE", f"/webhook_endpoints/{ep['id']}")
            print(f"   old webhook {ep['id']}: replaced")
    fields = [("url", hook_url), ("description", "Quark API: sets the plan"),
              ("api_version", STRIPE_VERSION)] + [("enabled_events[]", e) for e in EVENTS]
    hook = s.call("POST", "/webhook_endpoints", fields)
    print(f"   webhook {hook['id']}: {hook_url}")

    # 4. Secret Manager
    if args.dry_run:
        print("== Dry run: Secret Manager not changed. The webhook secret is lost; run again without --dry-run.")
        return
    print(f"== Secret Manager ({args.project})")
    put_secret(args.project, "birdbrains-stripe-secret-key", key)
    put_secret(args.project, "birdbrains-stripe-webhook-secret", hook["secret"])
    put_secret(args.project, "birdbrains-stripe-price-id", price["id"])
    put_secret(args.project, "birdbrains-stripe-portal-config", portal["id"])
    print(f"\nDone ({mode}). Redeploy the API (./deploy.sh {args.project}) so it reads the new secrets.")


if __name__ == "__main__":
    main()
