import re

from conftest import auth, photo, upload


def test_requires_sign_in_and_profile(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.get("/me", headers=auth("nobody")).status_code == 403


def test_register_and_link(client, family):
    assert re.fullmatch(r"stu_[a-zA-Z0-9]{12}", family["studentId"])
    parent = client.get("/me", headers=auth("jordan")).json()
    assert parent["childStudentIds"] == [family["studentId"]]
    # Registering again cannot change role.
    again = client.post("/me", json={"role": "parent", "name": "x"}, headers=auth("alex")).json()
    assert again["role"] == "student"
    assert client.post("/me/children", json={"linkCode": "WRONGCODE"}, headers=auth("jordan")).status_code == 404
    assert client.post("/me/children", json={"linkCode": family["linkCode"]}, headers=auth("alex")).status_code == 403


def test_upload_quality_gates(client, family):
    sid = family["studentId"]
    small = [("files", ("p.jpg", photo(800, 600), "image/jpeg"))]
    assert upload(client, sid, files=small).status_code == 422
    assert upload(client, sid, data={"sharpnessScore": "20"}).status_code == 422
    junk = [("files", ("p.jpg", b"not an image", "image/jpeg"))]
    assert upload(client, sid, files=junk).status_code == 422
    assert upload(client, sid, data={"studentId": "std_alex_99"}).status_code == 422


def test_full_flow(client, family):
    sid = family["studentId"]
    r = upload(client, sid)
    assert r.status_code == 201, r.text
    sub = r.json()
    assert sub["status"] == "UPLOADED" and sub["imageResolution"] == {"width": 1600, "height": 1200}
    assert client.get(sub["fileUrls"][0], headers=auth("alex")).headers["content-type"] == "image/jpeg"

    done = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    grading = done["grading"]
    assert done["submission"]["status"] == "GRADED"
    assert grading["totalScore"] == 8.0 and grading["maxPossibleScore"] == 10.0
    assert grading["affectState"] == "HIGH_FRICTION_FRUSTRATION"
    assert [p["pillar"] for p in grading["pillarBreakdowns"]] == ["CON", "PRC", "FAC", "TST"]
    # Carry-forward: step 5 is protected and only one root cause is reported.
    assert grading["stepDiagnostics"][4]["isCarryForwardProtected"] is True
    assert [e["misconceptionId"] for e in grading["entityExtractions"]] == ["PRC-03"]
    assert grading["pillarBreakdowns"][1]["errorCount"] == 1

    # Idempotent.
    again = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert again["grading"]["gradingId"] == grading["gradingId"]
    assert client.get(f"/students/{sid}/gradings/latest", headers=auth("alex")).json()["gradingId"] == grading["gradingId"]

    # Worksheet arrives with the nightly batch.
    ws_url = f"/gradings/{grading['gradingId']}/worksheet"
    assert client.get(ws_url, headers=auth("alex")).json()["detail"] == "WORKSHEET_QUEUED"
    assert client.post("/internal/batch/worksheets/submit").status_code == 401
    token = {"X-Batch-Token": "s3cret"}
    assert client.post("/internal/batch/worksheets/submit", headers=token).json()["submitted"] == 1
    assert client.post("/internal/batch/worksheets/submit", headers=token).json()["submitted"] == 0
    assert client.post("/internal/batch/worksheets/collect", headers=token).json()["ready"] == 1
    ws = client.get(ws_url, headers=auth("alex")).json()
    assert ws["sectionB_FadedScaffolding"][1]["scaffoldingType"] == "PARTIAL_BLANK"
    assert ws["sectionC_IndependentTransfer"]["targetPillarFocus"] == "PRC"

    # Parent view.
    summary = client.get(f"/students/{sid}/parent-summary", headers=auth("jordan")).json()
    assert summary["studentName"] == "Alex Mercer"
    assert summary["strandMasteries"][0]["strandName"] == "Quadratic Relations"
    assert summary["strandMasteries"][0]["currentEWMAMastery"] == 0.8
    assert summary["overallEqaoForecast"] == "LEVEL_4"
    assert summary["pillarErrorDistribution"] == [{"pillar": "PRC", "percentageOfTotalErrors": 100.0}]
    assert summary["cognitiveFrictionAlerts"][0]["frictionLevel"] == "HIGH_FRICTION_FRUSTRATION"


def test_other_families_cannot_see_data(client, family):
    sid = family["studentId"]
    sub = upload(client, sid).json()
    grading = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]
    for url in (
        f"/submissions/{sub['submissionId']}",
        sub["fileUrls"][0],
        f"/gradings/{grading['gradingId']}",
        f"/gradings/{grading['gradingId']}/worksheet",
        f"/students/{sid}/gradings",
        f"/students/{sid}/parent-summary",
    ):
        assert client.get(url, headers=auth("stranger")).status_code == 404, url
        assert client.get(url).status_code == 401, url
    assert upload(client, sid, uid="stranger").status_code == 404
    assert client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("stranger")).status_code == 404
    # A linked parent can upload for their child.
    assert upload(client, sid, uid="jordan").status_code == 201


def test_unreadable_page_asks_for_retake(client, family, deps):
    real = deps.pipeline.run_stage1
    deps.pipeline.run_stage1 = lambda ctx, images: real(ctx, images).model_copy(update={"requires_hitl": True})
    sub = upload(client, family["studentId"]).json()
    out = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert out["grading"] is None and out["submission"]["status"] == "NEEDS_RETAKE"


def test_pipeline_failure_is_reported(client, family, deps):
    def boom(ctx, stage1):
        raise RuntimeError("vertex down")

    deps.pipeline.run_stage2 = boom
    sub = upload(client, family["studentId"]).json()
    assert client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).status_code == 502
    assert client.get(f"/submissions/{sub['submissionId']}", headers=auth("alex")).json()["status"] == "FAILED"


def test_duplicate_photo_is_rejected(client, family):
    """UT-06: the same image bytes again is a 409 that points at the first submission."""
    sid = family["studentId"]
    page = photo()
    files = lambda: [("files", ("p.jpg", page, "image/jpeg"))]
    first = upload(client, sid, files=files())
    assert first.status_code == 201
    again = upload(client, sid, files=files())
    assert again.status_code == 409
    assert again.headers["location"] == f"/submissions/{first.json()['submissionId']}"
    # A different photo still goes through.
    assert upload(client, sid).status_code == 201
