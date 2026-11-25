"""Pro upgrades through Stripe Checkout (subscriptions).

The API never sees card details: it creates a Checkout or Billing Portal session
and the browser goes to Stripe. Stripe then calls ``POST /billing/webhook``; that
signed event is the only thing that changes a plan.

Uses Stripe's HTTPS API directly (form-encoded), so there is no SDK to pin. The
API version is pinned with the ``Stripe-Version`` header instead.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Optional, Protocol

log = logging.getLogger("birdbrains.billing")

WEBHOOK_TOLERANCE_SECONDS = 300
ACTIVE_STATUSES = {"active", "trialing", "past_due"}  # past_due keeps Pro while Stripe retries the card
# Pinned so changing the account's default API version in the dashboard cannot change
# what these calls send or return. Bump on purpose, after reading Stripe's changelog.
STRIPE_API_VERSION = "2025-03-31.basil"
PRICE_CACHE_SECONDS = 3600


class BillingError(Exception):
    pass


class Billing(Protocol):
    def checkout_url(self, uid: str, customer_id: Optional[str], success_url: str, cancel_url: str,
                     email: Optional[str] = None) -> str: ...

    def portal_url(self, customer_id: str, return_url: str) -> str: ...

    def price_info(self) -> dict:
        """The Pro price for display: ``{amount, currency, interval}``, amount in cents."""

    def cancel_subscriptions(self, customer_id: str) -> int:
        """Cancel every live subscription of a customer now (account deleted). Returns how many."""

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

    def __init__(self, secret_key: str, webhook_secret: str, price_id: str,
                 portal_configuration: Optional[str] = None) -> None:
        self._key, self._webhook_secret, self._price = secret_key, webhook_secret, price_id
        self._portal_config = portal_configuration  # None: the account's default portal settings
        self._price_cache: Optional[tuple[float, dict]] = None

    def _request(self, method: str, path: str, fields: Optional[dict[str, str]] = None) -> dict:
        headers = {"Authorization": f"Bearer {self._key}", "Stripe-Version": STRIPE_API_VERSION}
        data = None
        if method == "POST":
            data = urllib.parse.urlencode(fields or {}).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            headers["Idempotency-Key"] = str(uuid.uuid4())
        elif fields:
            path = f"{path}?{urllib.parse.urlencode(fields)}"
        req = urllib.request.Request(f"{self.API}{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            # Stripe's message names the bad parameter (never the key): log it for debugging.
            try:
                err = json.load(e).get("error", {})
                log.warning("Stripe %s %s -> %s %s: %s", method, path.split("?")[0], e.code,
                            err.get("code") or err.get("type"), err.get("message"))
            except (ValueError, AttributeError, OSError):
                pass
            raise BillingError(f"Stripe returned {e.code}") from None
        except OSError as e:
            raise BillingError(f"Stripe unreachable: {e}") from None

    def _post(self, path: str, fields: dict[str, str]) -> dict:
        return self._request("POST", path, fields)

    def _get(self, path: str, fields: Optional[dict[str, str]] = None) -> dict:
        return self._request("GET", path, fields)

    def checkout_url(self, uid: str, customer_id: Optional[str], success_url: str, cancel_url: str,
                     email: Optional[str] = None) -> str:
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
        elif email:
            fields["customer_email"] = email  # prefilled; Stripe creates the customer
        return self._post("/checkout/sessions", fields)["url"]

    def portal_url(self, customer_id: str, return_url: str) -> str:
        fields = {"customer": customer_id, "return_url": return_url}
        if self._portal_config:
            fields["configuration"] = self._portal_config
        return self._post("/billing_portal/sessions", fields)["url"]

    def price_info(self) -> dict:
        now = time.time()
        if self._price_cache and now - self._price_cache[0] < PRICE_CACHE_SECONDS:
            return self._price_cache[1]
        price = self._get(f"/prices/{urllib.parse.quote(self._price)}")
        info = {"amount": price.get("unit_amount"), "currency": price.get("currency"),
                "interval": (price.get("recurring") or {}).get("interval")}
        self._price_cache = (now, info)
        return info

    def cancel_subscriptions(self, customer_id: str) -> int:
        subs = self._get("/subscriptions", {"customer": customer_id, "status": "all", "limit": "100"})
        live = [s["id"] for s in subs.get("data", []) if s.get("status") not in ("canceled", "incomplete_expired")]
        for sub_id in live:
            self._request("DELETE", f"/subscriptions/{urllib.parse.quote(sub_id)}")
        return len(live)

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
    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded") \
            and obj.get("mode") == "subscription":
        if obj.get("payment_status") in ("paid", "no_payment_required"):
            return obj.get("client_reference_id"), obj.get("customer"), "pro"
        return None
    if kind in ("customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.created"):
        active = kind != "customer.subscription.deleted" and obj.get("status") in ACTIVE_STATUSES
        return (obj.get("metadata") or {}).get("uid"), obj.get("customer"), "pro" if active else "free"
    return None
