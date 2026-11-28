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

    def _request(self, method, path, fields=None):
        self.calls.append((path, fields) if method == "POST" else (f"{method} {path}", fields))
        if path.startswith("/prices/"):
            return {"unit_amount": 1299, "currency": "cad", "recurring": {"interval": "month"}}
        if path == "/subscriptions":
            return {"data": [{"id": "sub_live", "status": "active"}, {"id": "sub_old", "status": "canceled"}]}
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
    assert fields["success_url"] == "https://quark.study/account?upgrade=success"
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


def _hook(client, event):
    body = json.dumps(event).encode()
    return client.post("/billing/webhook", content=body, headers={"Stripe-Signature": _signed(body)})


def test_price_child_covered_order_and_delete(client, family, deps):
    assert client.get("/billing/price").json() == {"configured": False}
    deps.billing = stripe = FakeStripe()
    assert client.get("/billing/price").json() == {"configured": True, "amount": 1299, "currency": "cad",
                                                   "interval": "month"}
    client.get("/billing/price")
    assert sum(1 for p, _ in stripe.calls if p.startswith("GET /prices/")) == 1   # cached

    sub = lambda status, t, kind="customer.subscription.updated": {"type": kind, "created": t, "data": {
        "object": {"customer": "cus_1", "status": status, "metadata": {"uid": "jordan"}}}}
    assert _hook(client, sub("active", 200)).status_code == 200
    me = client.get("/me", headers=auth("jordan")).json()
    assert me["plan"] == "pro" and me["hasBilling"] is True
    # the child is already covered: no second subscription
    assert client.post("/billing/checkout", headers=auth("alex")).json()["detail"] == "COVERED_BY_PARENT"
    _hook(client, sub("canceled", 300, "customer.subscription.deleted"))
    _hook(client, sub("active", 250))                        # late, older event: ignored
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "free"
    _hook(client, sub("active", 400))
    assert client.get("/me", headers=auth("jordan")).json()["plan"] == "pro"

    assert client.delete("/me", headers=auth("jordan")).status_code == 204
    assert ("DELETE /subscriptions/sub_live", None) in stripe.calls
    assert not any(p == "DELETE /subscriptions/sub_old" for p, _ in stripe.calls)


def test_plan_change_mapping():
    sub = lambda kind, status: {"type": kind, "data": {"object": {"customer": "c", "status": status}}}
    assert plan_change(sub("customer.subscription.updated", "active")) == (None, "c", "pro")
    assert plan_change(sub("customer.subscription.updated", "unpaid")) == (None, "c", "free")
    assert plan_change({"type": "invoice.paid", "data": {"object": {}}}) is None
    unpaid = {"type": "checkout.session.completed", "data": {"object": {"mode": "subscription", "payment_status": "unpaid"}}}
    assert plan_change(unpaid) is None
    later = {"type": "checkout.session.async_payment_succeeded", "data": {"object": {
        "mode": "subscription", "payment_status": "paid", "client_reference_id": "u", "customer": "c"}}}
    assert plan_change(later) == ("u", "c", "pro")


class FakeClassroom:
    def __init__(self):
        self.revoked = []
        self.pages = {"f_ana": photo(), "f_ben": photo()}

    def auth_url(self, state, scopes=()):
        self.scopes = scopes
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

    def my_courses(self):
        return [{"id": "c1", "name": "MPM2D-01", "section": "Period 2"}]

    def my_work(self, course_id):
        assert course_id == "c1"
        return [{"id": "w1", "title": "Trig test", "description": "Show the formula before you substitute.",
                 "maxPoints": 20, "dueDate": "2026-11-20", "link": "https://classroom.test/w1",
                 "state": "RETURNED", "assignedGrade": 15,
                 "rubric": [{"title": "Method", "description": "Right ratio chosen",
                             "levels": [{"title": "Full", "points": 10}]}]},
                {"id": "w2", "title": "Homework", "description": "", "maxPoints": None, "dueDate": None,
                 "link": None, "state": "CREATED", "assignedGrade": None, "rubric": []}]

    def download(self, file_id):
        if file_id not in self.pages:
            raise ClassroomError("not a photo")
        return self.pages[file_id], "image/jpeg"


def test_classroom_connect_and_import(client, family, deps):
    client.post("/me", json={"role": "teacher", "name": "Ms. Rivera"}, headers=auth("rivera"))
    assert client.post("/classroom/connect", headers=auth("jordan")).status_code == 403   # parents can't
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "PRO_ONLY"
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "CLASSROOM_BETA_NOT_APPROVED"
    client.post("/classroom/beta", json={"googleEmail": "rivera@school.test"}, headers=auth("rivera"))
    client.post("/internal/classroom-beta", json={"uid": "rivera", "status": "approved"}, headers=TOKEN)
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "CLASSROOM_NOT_CONFIGURED"
    deps.classroom = google = FakeClassroom()
    assert client.get("/classroom/courses", headers=auth("rivera")).json()["detail"] == "CLASSROOM_NOT_CONNECTED"

    url = client.post("/classroom/connect", headers=auth("rivera")).json()["url"]
    state = url.split("state=")[1]
    r = client.get(f"/classroom/callback?state=forged&code=good", follow_redirects=False)
    assert r.headers["location"].endswith("classroom=failed")
    r = client.get(f"/classroom/callback?state={state}&code=good", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "https://quark.study/teacher?classroom=connected"
    r = client.get(f"/classroom/callback?state={state}&code=good", follow_redirects=False)  # state is single-use
    assert r.headers["location"].endswith("classroom=failed")
    assert client.get("/classroom/status", headers=auth("rivera")).json() == {"configured": True, "plan": "pro", "connected": True, "beta": "approved"}

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
    assert deps.store.get("classroombeta", "rivera") is None


def test_google_auth_url():
    url = GoogleClassroom("cid", "sec", "https://api.test/classroom/callback").auth_url("st")
    assert "access_type=offline" in url and "state=st" in url and "classroom.coursework.students.readonly" in url
    assert "redirect_uri=https%3A%2F%2Fapi.test%2Fclassroom%2Fcallback" in url


def test_classroom_grade_sync_is_refused(client, deps):
    """Google only lets the app that created an assignment set its grades."""
    client.post("/me", json={"role": "teacher", "name": "Ms. Rivera"}, headers=auth("rivera"))
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    client.post("/classroom/beta", json={"googleEmail": "rivera@school.test"}, headers=auth("rivera"))
    client.post("/internal/classroom-beta", json={"uid": "rivera", "status": "approved"}, headers=TOKEN)
    deps.classroom = FakeClassroom()
    r = client.post("/classroom/courses/c1/coursework/w1/sync", headers=auth("rivera"))
    assert r.status_code == 501 and r.json()["detail"] == "CLASSROOM_GRADE_SYNC_UNSUPPORTED"


def test_classroom_beta_signup_and_approval(client, deps, monkeypatch):
    """Pro teachers sign up; only approved ones (Google Test users) can connect."""
    deps.classroom = FakeClassroom()
    client.post("/me", json={"role": "teacher", "name": "Ms. Rivera"}, headers=auth("rivera"))
    join = {"googleEmail": "Rivera@School.test"}
    assert client.post("/classroom/beta", json=join, headers=auth("rivera")).json()["detail"] == "PRO_ONLY"
    assert client.post("/classroom/beta", json=join, headers=auth("jordan")).status_code == 403  # not a teacher
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    assert client.post("/classroom/beta", json={"googleEmail": "nope"}, headers=auth("rivera")).status_code == 422
    assert client.get("/classroom/status", headers=auth("rivera")).json()["beta"] == "none"

    r = client.post("/classroom/beta", json=join, headers=auth("rivera")).json()
    assert r == {"beta": "pending", "googleEmail": "rivera@school.test"}
    gc = next(p for p in client.get("/lms/providers", headers=auth("rivera")).json() if p["id"] == "google_classroom")
    assert gc["beta"] == "pending"
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["detail"] == "CLASSROOM_BETA_NOT_APPROVED"
    assert client.get("/classroom/courses", headers=auth("rivera")).json()["detail"] == "CLASSROOM_BETA_NOT_APPROVED"

    # Admin only, with the batch token.
    assert client.get("/internal/classroom-beta").status_code in (401, 403)
    rows = client.get("/internal/classroom-beta?status=pending", headers=TOKEN).json()
    assert [(r["name"], r["googleEmail"]) for r in rows] == [("Ms. Rivera", "rivera@school.test")]
    assert client.get("/internal/stats", headers=TOKEN).json()["classroomBetaPending"] == 1
    assert client.post("/internal/classroom-beta", json={"googleEmail": "x@y.test", "status": "approved"},
                       headers=TOKEN).status_code == 404
    ok = client.post("/internal/classroom-beta", json={"googleEmail": "rivera@school.test", "status": "approved"},
                     headers=TOKEN).json()
    assert ok["status"] == "approved"
    assert client.post("/classroom/connect", headers=auth("rivera")).json()["url"].startswith("https://accounts.google.test")
    # Signing up again with the same email keeps the approval; a new email starts over.
    assert client.post("/classroom/beta", json=join, headers=auth("rivera")).json()["beta"] == "approved"

    # The group is capped (Google allows 100 test users).
    client.post("/me", json={"role": "teacher", "name": "Mr. Lee"}, headers=auth("lee"))
    client.post("/internal/users/lee/plan", json={"plan": "pro"}, headers=TOKEN)
    client.post("/classroom/beta", json={"googleEmail": "lee@school.test"}, headers=auth("lee"))
    monkeypatch.setenv("BIRDBRAINS_CLASSROOM_BETA_LIMIT", "1")
    from birdbrains.api import create_app
    from fastapi.testclient import TestClient
    capped = TestClient(create_app(deps))
    r = capped.post("/internal/classroom-beta", json={"uid": "lee", "status": "approved"}, headers=TOKEN)
    assert r.status_code == 409

    # Declining an approved teacher disconnects them.
    deps.store.put("googletokens", "rivera", {"uid": "rivera", "refreshToken": "refresh-1"})
    client.post("/internal/classroom-beta", json={"uid": "rivera", "status": "declined"}, headers=TOKEN)
    assert deps.store.get("googletokens", "rivera") is None
    assert client.get("/classroom/status", headers=auth("rivera")).json()["beta"] == "declined"


def test_student_classroom_grades_and_upload_portal(client, family, deps):
    """A Pro student connects their own Classroom, sees each assignment's grade and the
    teacher's instructions, and uploads a test for it; grading gets the instructions."""
    google = deps.classroom = FakeClassroom()
    sid = family["studentId"]
    join = {"googleEmail": "alex@gmail.test"}
    assert client.post("/classroom/beta", json=join, headers=auth("alex")).json()["detail"] == "PRO_ONLY"
    client.post("/internal/users/jordan/plan", json={"plan": "pro"}, headers=TOKEN)  # a Pro parent covers the child
    assert client.post("/classroom/beta", json=join, headers=auth("alex")).json()["beta"] == "pending"
    assert client.post("/classroom/beta", json=join, headers=auth("jordan")).status_code == 403  # parents can't
    assert client.post("/classroom/connect", headers=auth("alex")).json()["detail"] == "CLASSROOM_BETA_NOT_APPROVED"
    client.post("/internal/classroom-beta", json={"uid": "alex", "status": "approved"}, headers=TOKEN)

    url = client.post("/classroom/connect", headers=auth("alex")).json()["url"]
    assert all(".me.readonly" in sc or "courses.readonly" in sc for sc in google.scopes)   # student scopes only
    r = client.get(f"/classroom/callback?state={url.split('state=')[1]}&code=good", follow_redirects=False)
    assert r.headers["location"] == "https://quark.study/student?classroom=connected"

    assert client.get("/classroom/my/courses", headers=auth("alex")).json()[0]["id"] == "c1"
    assert client.get("/classroom/courses", headers=auth("alex")).status_code == 403   # teacher routes stay closed
    work = client.get("/classroom/my/courses/c1/work", headers=auth("alex")).json()
    assert work[0]["assignedGrade"] == 15 and work[0]["rubric"][0]["title"] == "Method"
    assert work[0]["submissionId"] is None

    seen = []
    real = deps.pipeline.run_stage2
    deps.pipeline.run_stage2 = lambda ctx, *a, **k: (seen.append(ctx.teacher_expectations), real(ctx, *a, **k))[1]
    r = client.post("/submissions", data={"studentId": sid, "sharpnessScore": "90", "classroomCourseId": "c1",
                                          "classroomWorkId": "w1"},
                    files=[("files", ("p.jpg", photo(), "image/jpeg"))], headers=auth("alex"))
    assert r.status_code == 201, r.text
    sub_id = r.json()["submissionId"]
    assert deps.store.get("submissions", sub_id)["forClassroom"]["title"] == "Trig test"
    client.post(f"/submissions/{sub_id}/process", headers=auth("alex"))
    assert seen and "Show the formula before you substitute." in seen[0] and "Rubric - Method" in seen[0]
    assert "15" not in seen[0]                                     # the teacher's grade is not sent to grading
    work = client.get("/classroom/my/courses/c1/work", headers=auth("alex")).json()
    assert work[0]["submissionId"] == sub_id and work[0]["gradingId"]

    # A parent can't upload against the child's Classroom, and unknown assignments are refused.
    r = client.post("/submissions", data={"studentId": sid, "sharpnessScore": "90", "classroomCourseId": "c1",
                                          "classroomWorkId": "w1"},
                    files=[("files", ("p.jpg", photo(), "image/jpeg"))], headers=auth("jordan"))
    assert r.status_code == 422
    r = client.post("/submissions", data={"studentId": sid, "sharpnessScore": "90", "classroomCourseId": "c1",
                                          "classroomWorkId": "nope"},
                    files=[("files", ("p.jpg", photo(), "image/jpeg"))], headers=auth("alex"))
    assert r.status_code == 404
