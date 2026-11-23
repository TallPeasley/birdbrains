"""Testing accounts: no monthly cap, repeat photos allowed, set only by an admin."""
from conftest import auth, photo, upload

ADMIN = {"X-Batch-Token": "s3cret"}


def make_tester(client, **who):
    return client.post("/internal/testers", json=who, headers=ADMIN)


def test_only_the_batch_token_can_grant_it(client, family):
    assert client.post("/internal/testers", json={"uid": "alex"}).status_code == 401
    assert client.post("/internal/testers", json={"uid": "alex"},
                       headers={"X-Batch-Token": "nope"}).status_code == 401
    # A signed-in user cannot slip the flag in through their own profile routes.
    assert client.patch("/me", json={"name": "Alex", "tester": True}, headers=auth("alex")).json()["tester"] is False
    assert client.post("/me", json={"role": "student", "name": "A", "course": "MPM2D", "tester": True},
                       headers=auth("alex")).json()["tester"] is False
    fresh = client.post("/me", json={"role": "student", "name": "New", "course": "MPM2D", "tester": True},
                        headers=auth("newkid"))
    assert fresh.json()["tester"] is False


def test_tester_has_no_cap_and_can_resend_a_photo(client, family, deps):
    deps.free_monthly_limit = 1
    sid = family["studentId"]
    r = make_tester(client, email="alex@example.com")
    assert r.status_code == 200 and r.json()["tester"] is True
    usage = client.get(f"/students/{sid}/usage", headers=auth("alex")).json()
    assert usage["monthlyLimit"] is None and usage["remaining"] is None and usage["plan"] == "pro"
    same = photo()
    for _ in range(3):
        assert upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).status_code == 201
    assert upload(client, sid).status_code == 201


def test_turning_it_off_restores_the_limits(client, family, deps):
    deps.free_monthly_limit = 1
    sid = family["studentId"]
    make_tester(client, uid="alex")
    same = photo()
    assert upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).status_code == 201
    assert make_tester(client, uid="alex", tester=False).json()["tester"] is False
    assert upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).status_code == 402
    deps.free_monthly_limit = 10
    assert upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).status_code == 409


def test_a_tester_parent_covers_their_linked_child(client, family, deps):
    deps.free_monthly_limit = 1
    make_tester(client, uid="jordan")
    sid = family["studentId"]
    assert upload(client, sid, uid="jordan").status_code == 201
    assert upload(client, sid, uid="jordan").status_code == 201


def test_unknown_account_and_missing_target(client, family):
    assert make_tester(client, email="nobody@example.com").status_code == 404
    assert make_tester(client).status_code == 422


def test_tester_uploads_stay_out_of_pilot_stats(client, family):
    make_tester(client, uid="alex")
    upload(client, family["studentId"])
    s = client.get("/internal/stats", headers=ADMIN).json()
    assert s["uploads"] == 0 and s["testerUploads"] == 1 and s["activeStudents"] == 0


def test_tester_can_recheck_an_old_upload(client, family, deps):
    sid = family["studentId"]
    sub = upload(client, sid).json()["submissionId"]
    first = client.post(f"/submissions/{sub}/process", headers=auth("alex")).json()["grading"]
    # Not a tester yet: re-checking is refused.
    assert client.post(f"/submissions/{sub}/regrade", headers=auth("alex")).status_code == 403
    assert make_tester(client, uid="alex").status_code == 200
    ledger_before = deps.store.get("ledgers", sid)
    again = client.post(f"/submissions/{sub}/regrade", headers=auth("alex"))
    assert again.status_code == 200, again.text
    second = again.json()["grading"]
    assert second["gradingId"] != first["gradingId"] and second["submissionId"] == sub
    # The old grading is replaced, and the work does not count twice.
    history = client.get(f"/students/{sid}/gradings", headers=auth("alex")).json()
    assert [g["gradingId"] for g in history] == [second["gradingId"]]
    assert deps.store.get("ledgers", sid) == ledger_before


def test_tester_switches_view_and_plan_on_the_fly(client, family, deps):
    deps.free_monthly_limit = 1
    sid = family["studentId"]
    # Not a tester yet: the switch is refused.
    assert client.post("/me/tester-view", json={"role": "parent"}, headers=auth("alex")).status_code == 403
    make_tester(client, uid="alex")
    assert upload(client, sid).status_code == 201

    # Free view: the meter shows the cap, but a tester is never stopped by it.
    me = client.post("/me/tester-view", json={"plan": "free"}, headers=auth("alex")).json()
    assert me["plan"] == "free" and me["role"] == "student"
    usage = client.get(f"/students/{sid}/usage", headers=auth("alex")).json()
    assert usage["plan"] == "free"
    assert upload(client, sid).status_code == 201

    # Parent view: linked to their own student record, listed by name.
    me = client.post("/me/tester-view", json={"role": "parent", "plan": "pro"}, headers=auth("alex")).json()
    assert me["role"] == "parent" and me["plan"] == "pro" and sid in me["childStudentIds"]
    assert me["children"] == [{"studentId": sid, "name": "Alex Mercer", "course": "MPM2D"}]
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["plan"] == "pro"

    # Teacher view: on their own class list, and the Pro class report works.
    me = client.post("/me/tester-view", json={"role": "teacher"}, headers=auth("alex")).json()
    assert me["role"] == "teacher"
    roster = client.get("/teacher/students", headers=auth("alex")).json()
    assert [r["studentId"] for r in roster] == [sid] and roster[0]["linkedAccount"] is True
    assert client.get(f"/students/{sid}/progress", headers=auth("alex")).status_code == 200
    assert client.get("/teacher/report", headers=auth("alex")).status_code == 200
    client.post("/me/tester-view", json={"plan": "free"}, headers=auth("alex"))
    assert client.get("/teacher/report", headers=auth("alex")).status_code == 402

    # And back to student, with the same uploads.
    me = client.post("/me/tester-view", json={"role": "student"}, headers=auth("alex")).json()
    assert me["role"] == "student" and me["studentId"] == sid


def test_tester_who_signed_up_as_a_parent_gets_a_student_record(client, family):
    make_tester(client, uid="jordan")
    me = client.post("/me/tester-view", json={"role": "student", "course": "MTH1W"}, headers=auth("jordan")).json()
    assert me["role"] == "student" and me["studentId"] and me["course"] == "MTH1W" and me["linkCode"]


def test_tester_flag_cannot_be_set_through_the_switch(client, family):
    make_tester(client, uid="alex")
    r = client.post("/me/tester-view", json={"role": "parent", "tester": True}, headers=auth("alex"))
    assert r.status_code == 422
