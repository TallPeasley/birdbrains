from birdbrains.demo_classroom import CLASSES, DemoClassroom

from conftest import auth

TOKEN = {"X-Batch-Token": "s3cret"}


def test_demo_classroom_end_to_end(client, deps):
    deps.classroom = DemoClassroom("http://localhost:8080")
    client.post("/me", json={"role": "teacher", "name": "Test Teacher"}, headers=auth("rivera"))
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    client.post("/classroom/beta", json={"googleEmail": "rivera@school.test"}, headers=auth("rivera"))
    client.post("/internal/classroom-beta", json={"uid": "rivera", "status": "approved"}, headers=TOKEN)
    url = client.post("/classroom/connect", headers=auth("rivera")).json()["url"]
    assert url.endswith("&code=demo")
    path = url.replace("http://localhost:8080", "")
    assert client.get(path, follow_redirects=False).headers["location"].endswith("classroom=connected")

    courses = client.get("/classroom/courses", headers=auth("rivera")).json()
    assert [c["name"] for c in courses] == ["MPM2D-01", "MPM2D-03", "MTH1W-02"]

    imported = 0
    for cid, _, _, work in CLASSES:
        for wid, _, _ in work:
            body = {"course": "MTH1W" if cid == "demo-c3" else "MPM2D", "unitTopic": "Test"}
            res = client.post(f"/classroom/courses/{cid}/coursework/{wid}/import", json=body, headers=auth("rivera")).json()
            reasons = {s["reason"] for s in res["skipped"]}
            assert reasons == {"Not handed in yet", "No photo attached (JPEG, PNG or WebP)"}, reasons
            imported += len(res["imported"])
    assert imported == 6 * 6  # six work items, six photos each

    first = client.get("/classroom/courses/demo-c1/coursework", headers=auth("rivera")).json()[0]
    assert "BB-W11" in first["title"]
    roster = client.get("/teacher/students", headers=auth("rivera")).json()
    assert len(roster) == 18  # six students per class have a readable photo
