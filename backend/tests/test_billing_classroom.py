import hashlib
import hmac
import json
import time

import pytest

from conftest import auth, photo, upload
from birdbrains.billing import BillingError, StripeBilling, plan_change, verify_signature
from birdbrains.classroom import ClassroomError, GoogleClassroom

TOKEN = {"X-Batch-Token": "s3cret"}


def _signed(payload: bytes, secret="whsec_test", t=None):
    t = int(t or time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={t},v1={sig}"


class FakeStripe(StripeBilling):
    """Real signature checking and event parsing; no network."""

    def __init__(self):
        super().__init__("sk_test_x", "whsec_test", "price_x")
        self.calls = []

    def _post(self, path, fields):
        self.calls.append((path, fields))
        return {"url": f"https://checkout.stripe.test{path}"}


def test_signature_checks():
    body = b'{"type":"x"}'
    verify_signature(body, _signed(body), "whsec_test")
    for bad in ("", "t=1,v1=00", _signed(body, secret="other"), _signed(body, t=time.time() - 3600)):
        with pytest.raises(BillingError):
            verify_signature(body, bad, "whsec_test")
    with pytest.raises(BillingError):
        verify_signature(body + b" ", _signed(body), "whsec_test")


def test_stripe_upgrade_and_cancel(client, family, deps):
    assert client.post("/billing/checkout", headers=auth("jordan")).json()["detail"] == "BILLING_NOT_CONFIGURED"
    deps.billing = stripe = FakeStripe()
    url = client.post("/billing/checkout", headers=auth("jordan")).json()["url"]
    assert url.endswith("/checkout/sessions")
    fields = stripe.calls[0][1]
    assert fields["client_reference_id"] == "jordan" and fields["mode"] == "subscription"
    assert fields["success_url"] == "https://birdbrains.netlify.app/account?upgrade=success"
    assert client.post("/billing/portal", headers=auth("jordan")).json()["detail"] == "NO_SUBSCRIPTION"

    def hook(event, header=None):
        body = json.dumps(event).encode()
        return client.post("/billing/webhook", content=body, headers={"Stripe-Signature": header or _signed(body)})

    done = {"type": "checkout.session.completed", "data": {"object": {
        "mode": "subscription", "payment_status": "paid", "client_reference_id": "jordan", "customer": "cus_1"}}}
    assert hook(done, "t=1,v1=bad").status_code == 400          # forged: nothing changes
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "free"
    assert hook(done).status_code == 200
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "pro"
    sid = family["studentId"]                                    # a Pro parent covers the child
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["plan"] == "pro"
    assert client.post("/billing/checkout", headers=auth("jordan")).json()["detail"] == "ALREADY_PRO"
    assert client.post("/billing/portal", headers=auth("jordan")).json()["url"].endswith("/billing_portal/sessions")
    assert "stripeCustomerId" not in client.get("/me", headers=auth("jordan")).json()

    other = {"type": "customer.subscription.deleted", "data": {"object": {"customer": "cus_other", "status": "canceled"}}}
    hook(other)
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "pro"
    gone = {"type": "customer.subscription.deleted", "data": {"object": {"customer": "cus_1", "status": "canceled"}}}
    hook(gone)
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "free"


def test_plan_change_mapping():
    sub = lambda kind, status: {"type": kind, "data": {"object": {"customer": "c", "status": status}}}
    assert plan_change(sub("customer.subscription.updated", "active")) == (None, "c", "pro")
    assert plan_change(sub("customer.subscription.updated", "unpaid")) == (None, "c", "free")
    assert plan_change({"type": "invoice.paid", "data": {"object": {}}}) is None
    unpaid = {"type": "checkout.session.completed", "data": {"object": {"mode": "subscription", "payment_status": "unpaid"}}}
    assert plan_change(unpaid) is None


class FakeClassroom:
    def __init__(self):
        self.revoked = []
        self.pages = {"f_ana": photo(), "f_ben": photo()}

    def auth_url(self, state):
        return f"https://accounts.google.test/auth?state={state}"

    def exchange(self, code):
        if code != "good":
            raise ClassroomError("bad code")
        return "refresh-1"

    def open(self, refresh_token):
        assert refresh_token == "refresh-1"
        return self

    def revoke(self, refresh_token):
        self.revoked.append(refresh_token)

    def courses(self):
        return [{"id": "c1", "name": "MPM2D-01", "section": "Period 2"}]

    def coursework(self, course_id):
        return [{"id": "w1", "title": "Quadratics quiz corrections"}]

    def student_names(self, course_id):
        return {"g_ana": "Ana Silva", "g_ben": "Ben Okoro", "g_cy": "Cy Tran", "g_di": "Di Wu"}

    def submissions(self, course_id, work_id):
        return [
            {"userId": "g_ana", "state": "TURNED_IN", "files": [{"id": "f_ana", "title": "p1.jpg"}]},
            {"userId": "g_ben", "state": "RETURNED", "files": [{"id": "f_ben", "title": "p.jpg"}, {"id": "f_pdf", "title": "x.pdf"}]},
            {"userId": "g_cy", "state": "CREATED", "files": []},
            {"userId": "g_di", "state": "TURNED_IN", "files": [{"id": "f_pdf", "title": "x.pdf"}]},
        ]

    def download(self, file_id):
        if file_id not in self.pages:
            raise ClassroomError("not a photo")
        return self.pages[file_id], "image/jpeg"


def test_classroom_connect_and_import(client, family, deps):
    client.post("/me", json={"role": "teacher", "name": "Ms. Rivera"}, headers=auth("rivera"))
    assert client.post("/classroom/connect", headers=auth("jordan")).status_code == 403   # parents can't
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "PRO_ONLY"
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "CLASSROOM_NOT_CONFIGURED"
    deps.classroom = google = FakeClassroom()
    assert client.get("/classroom/courses", headers=auth("rivera")).json()["detail"] == "CLASSROOM_NOT_CONNECTED"

    url = client.post("/classroom/connect", headers=auth("rivera")).json()["url"]
    state = url.split("state=")[1]
    r = client.get(f"/classroom/callback?state=forged&code=good", follow_redirects=False)
    assert r.headers["location"].endswith("classroom=failed")
    r = client.get(f"/classroom/callback?state={state}&code=good", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "https://birdbrains.netlify.app/teacher?classroom=connected"
    r = client.get(f"/classroom/callback?state={state}&code=good", follow_redirects=False)  # state is single-use
    assert r.headers["location"].endswith("classroom=failed")
    assert client.get("/classroom/status", headers=auth("rivera")).json() == {"configured": True, "plan": "pro", "connected": True}

    assert client.get("/classroom/courses", headers=auth("rivera")).json()[0]["name"] == "MPM2D-01"
    assert client.get("/classroom/courses/c1/coursework", headers=auth("rivera")).json()[0]["id"] == "w1"
    imp_url = "/classroom/courses/c1/coursework/w1/import"
    body = {"course": "MPM2D", "unitTopic": "Quadratic Relations"}
    res = client.post(imp_url, json=body, headers=auth("rivera")).json()
    assert [i["studentName"] for i in res["imported"]] == ["Ana Silva", "Ben Okoro"]
    assert {s["studentName"]: s["reason"] for s in res["skipped"]} == {
        "Cy Tran": "Not handed in yet", "Di Wu": "No photo attached (JPEG, PNG or WebP)"}
    again = client.post(imp_url, json=body, headers=auth("rivera")).json()   # importing twice adds nothing
    assert again["imported"] == [] and {s["reason"] for s in again["skipped"]} >= {"Already imported"}

    ana = res["imported"][0]
    sub = deps.store.get("submissions", ana["submissionId"])
    assert sub["source"] == "classroom" and sub["sharpnessScore"] is None
    done = client.post(f"/submissions/{ana['submissionId']}/process", headers=auth("rivera")).json()
    assert done["grading"]["plan"] == "pro" and done["grading"]["affectState"]     # teacher's Pro covers the class
    roster = client.get("/teacher/students", headers=auth("rivera")).json()
    assert [(s["name"], s["course"]) for s in roster] == [("Ana Silva", "MPM2D"), ("Ben Okoro", "MPM2D")]
    summary = client.get(f"/students/{ana['studentId']}/parent-summary", headers=auth("rivera")).json()
    assert summary["studentName"] == "Ana Silva"
    # Other accounts cannot see the class, and the teacher cannot see other families.
    assert client.get(f"/students/{ana['studentId']}/gradings", headers=auth("jordan")).status_code == 404
    assert client.get(f"/students/{family['studentId']}/gradings", headers=auth("rivera")).status_code == 404
    assert client.get("/teacher/students", headers=auth("jordan")).status_code == 403

    assert client.delete("/me", headers=auth("rivera")).status_code == 204             # takes the class data with it
    assert google.revoked == ["refresh-1"]
    assert deps.store.query("rosters", "teacherUid", "rivera") == []
    assert deps.store.get("submissions", ana["submissionId"]) is None
    assert deps.store.get("googletokens", "rivera") is None


def test_google_auth_url():
    url = GoogleClassroom("cid", "sec", "https://api.test/classroom/callback").auth_url("st")
    assert "access_type=offline" in url and "state=st" in url and "classroom.coursework.students.readonly" in url
    assert "redirect_uri=https%3A%2F%2Fapi.test%2Fclassroom%2Fcallback" in url
