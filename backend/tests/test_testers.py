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
