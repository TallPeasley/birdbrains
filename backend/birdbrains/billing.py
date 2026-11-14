"""Pro upgrades through Stripe Checkout (subscriptions).

The API never sees card details: it creates a Checkout or Billing Portal session
and the browser goes to Stripe. Stripe then calls ``POST /billing/webhook``; that
signed event is the only thing that changes a plan.

Uses Stripe's HTTPS API directly (form-encoded), so there is no SDK to pin.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Protocol

WEBHOOK_TOLERANCE_SECONDS = 300
ACTIVE_STATUSES = {"active", "trialing", "past_due"}  # past_due keeps Pro while Stripe retries the card


class BillingError(Exception):
    pass


class Billing(Protocol):
    def checkout_url(self, uid: str, customer_id: Optional[str], success_url: str, cancel_url: str) -> str: ...

    def portal_url(self, customer_id: str, return_url: str) -> str: ...

    def parse_webhook(self, payload: bytes, signature_header: str) -> dict:
        """Return the verified event or raise ``BillingError``."""


def verify_signature(payload: bytes, header: str, secret: str, now: Optional[float] = None) -> None:
    """Stripe-Signature: ``t=<unix>,v1=<hex hmac of "t.payload">`` (several v1 allowed)."""
    parts = [p.split("=", 1) for p in header.split(",") if "=" in p]
    stamp = next((v for k, v in parts if k == "t"), None)
    sigs = [v for k, v in parts if k == "v1"]
    if not stamp or not stamp.isdigit() or not sigs:
        raise BillingError("malformed signature header")
    if abs((now if now is not None else time.time()) - int(stamp)) > WEBHOOK_TOLERANCE_SECONDS:
        raise BillingError("signature timestamp outside tolerance")
    expected = hmac.new(secret.encode(), stamp.encode() + b"." + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, s) for s in sigs):
        raise BillingError("signature mismatch")


class StripeBilling:
    API = "https://api.stripe.com/v1"

    def __init__(self, secret_key: str, webhook_secret: str, price_id: str) -> None:
        self._key, self._webhook_secret, self._price = secret_key, webhook_secret, price_id

    def _post(self, path: str, fields: dict[str, str]) -> dict:
        req = urllib.request.Request(
            f"{self.API}{path}", data=urllib.parse.urlencode(fields).encode(), method="POST",
            headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise BillingError(f"Stripe returned {e.code}") from None
        except OSError as e:
            raise BillingError(f"Stripe unreachable: {e}") from None

    def checkout_url(self, uid: str, customer_id: Optional[str], success_url: str, cancel_url: str) -> str:
        fields = {
            "mode": "subscription",
            "line_items[0][price]": self._price,
            "line_items[0][quantity]": "1",
            "client_reference_id": uid,
            "metadata[uid]": uid,
            "subscription_data[metadata][uid]": uid,
            "success_url": success_url,
            "cancel_url": cancel_url,
            "allow_promotion_codes": "true",
        }
        if customer_id:
            fields["customer"] = customer_id
        return self._post("/checkout/sessions", fields)["url"]

    def portal_url(self, customer_id: str, return_url: str) -> str:
        return self._post("/billing_portal/sessions", {"customer": customer_id, "return_url": return_url})["url"]

    def parse_webhook(self, payload: bytes, signature_header: str) -> dict:
        verify_signature(payload, signature_header, self._webhook_secret)
        try:
            return json.loads(payload)
        except ValueError:
            raise BillingError("webhook body is not JSON") from None


def plan_change(event: dict) -> Optional[tuple[Optional[str], Optional[str], str]]:
    """Map a Stripe event to ``(uid, customer_id, plan)``, or None if it does not
    change a plan. ``uid`` may be None for subscription events (look up by customer)."""
    obj = event.get("data", {}).get("object", {})
    kind = event.get("type")
    if kind == "checkout.session.completed" and obj.get("mode") == "subscription":
        if obj.get("payment_status") in ("paid", "no_payment_required"):
            return obj.get("client_reference_id"), obj.get("customer"), "pro"
        return None
    if kind in ("customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.created"):
        active = kind != "customer.subscription.deleted" and obj.get("status") in ACTIVE_STATUSES
        return (obj.get("metadata") or {}).get("uid"), obj.get("customer"), "pro" if active else "free"
    return None
