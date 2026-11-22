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
    """Pro plan (set on the parent, which covers the linked child)."""
    sid = family["studentId"]
    assert client.post("/internal/users/jordan/plan", json={"plan": "pro"},
                       headers={"X-Batch-Token": "s3cret"}).json()["plan"] == "pro"
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
    assert len(grading["questionAnalyses"]) == 1
    q1 = grading["questionAnalyses"][0]
    assert q1["questionNumber"] == "1"
    assert q1["answerKey"]["finalAnswer"]
    assert q1["finalAnswerVerification"]["satisfiesInitialQuestion"] is False
    assert any(c["status"] == "MISSING" for c in q1["keyStepChecks"])
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
    deps.pipeline.run_stage1 = lambda ctx, images, meter=None: real(ctx, images).model_copy(update={"requires_hitl": True})
    sub = upload(client, family["studentId"]).json()
    out = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert out["grading"] is None and out["submission"]["status"] == "NEEDS_RETAKE"


def test_pipeline_failure_is_reported(client, family, deps):
    def boom(ctx, stage1, **kw):
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


def test_free_plan(client, family, deps):
    sid = family["studentId"]
    assert client.get("/me", headers=auth("alex")).json()["plan"] == "free"
    assert client.post("/internal/users/alex/plan", json={"plan": "pro"}).status_code == 401
    sub = upload(client, sid).json()
    grading = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]
    # Diagnosis and feedback yes; mood, scaffolding mode and worksheets no.
    assert grading["plan"] == "free" and grading["affectState"] is None and grading["scaffoldingMode"] is None
    assert grading["entityExtractions"][0]["misconceptionId"] == "PRC-03"
    assert grading["supportiveFramingMessage"]
    stored = deps.store.get("gradings", grading["gradingId"])
    assert stored["stage2"]["sentiment_entities"] == []  # no affect telemetry kept
    assert deps.store.get("ledgers", sid)["valence_ewma"] is None
    ws = client.get(f"/gradings/{grading['gradingId']}/worksheet", headers=auth("alex")).json()
    assert ws["detail"] == "WORKSHEET_PRO_ONLY"
    summary = client.get(f"/students/{sid}/parent-summary", headers=auth("jordan")).json()
    assert summary["cognitiveFrictionAlerts"] == [] and summary["strandMasteries"]


def test_free_monthly_cap(client, family, deps):
    sid = family["studentId"]
    deps.free_monthly_limit = 2
    assert upload(client, sid).status_code == 201
    u = client.get(f"/students/{sid}/usage", headers=auth("jordan")).json()
    assert (u["plan"], u["monthlyLimit"], u["usedThisMonth"], u["remaining"]) == ("free", 2, 1, 1)
    assert upload(client, sid).status_code == 201
    r = upload(client, sid)
    assert r.status_code == 402 and r.json()["detail"] == "FREE_LIMIT_REACHED"
    client.post("/internal/users/alex/plan", json={"plan": "pro"}, headers={"X-Batch-Token": "s3cret"})
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["monthlyLimit"] is None
    assert upload(client, sid).status_code == 201


def test_extension_upload_link(client, family, deps):
    sid = family["studentId"]
    body = {"studentId": sid, "course": "MPM2D", "unitTopic": "Factoring", "sharpnessScore": 80}
    assert client.post("/uploads", json=body, headers=auth("stranger")).status_code == 404
    t = client.post("/uploads", json=body, headers=auth("alex")).json()
    assert t["method"] == "PUT" and t["uploadUrl"].startswith(f"/uploads/{t['uploadId']}/file?token=")
    assert client.put(f"/uploads/{t['uploadId']}/file?token=wrong", content=photo()).status_code == 404
    assert client.put(t["uploadUrl"], content=b"junk").status_code == 422  # a bad file does not burn the link
    r = client.put(t["uploadUrl"], content=photo(), headers={"Content-Type": "image/jpeg"})  # no sign-in header
    assert r.status_code == 201 and r.json()["status"] == "UPLOADED"
    sub = r.json()["submissionId"]
    assert deps.store.get("submissions", sub)["source"] == "extension"
    assert client.put(t["uploadUrl"], content=photo()).status_code == 404  # one use only
    done = client.post(f"/submissions/{sub}/process", headers=auth("alex")).json()
    assert done["submission"]["status"] == "GRADED"
    assert client.get(f"/submissions/{sub}", headers=auth("alex")).json()["gradingId"]

    t2 = client.post("/uploads", json=body, headers=auth("alex")).json()
    ticket = deps.store.get("uploadtickets", t2["uploadId"])
    deps.store.put("uploadtickets", t2["uploadId"], ticket | {"expiresAt": "2020-01-01T00:00:00+00:00"})
    assert client.put(t2["uploadUrl"], content=photo()).json()["detail"] == "UPLOAD_LINK_EXPIRED"


def test_worksheet_pdf(client, family):
    sid = family["studentId"]
    token = {"X-Batch-Token": "s3cret"}
    client.post("/internal/users/alex/plan", json={"plan": "pro"}, headers=token)
    sub = upload(client, sid).json()
    g = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]
    url = f"/gradings/{g['gradingId']}/worksheet.pdf"
    assert client.get(url, headers=auth("alex")).status_code == 404  # not generated yet
    client.post("/internal/batch/worksheets/submit", headers=token)
    client.post("/internal/batch/worksheets/collect", headers=token)
    r = client.get(url, headers=auth("jordan"))
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content[:5] == b"%PDF-"
    assert client.get(url, headers=auth("stranger")).status_code == 404


def test_free_cap_holds_when_uploads_arrive_at_once(client, family, deps):
    """12 uploads sent together on a cap of 10: exactly 10 get in, even though every
    request passed the first usage check before any of them was stored."""
    from concurrent.futures import ThreadPoolExecutor

    sid = family["studentId"]
    upload(client, sid)                                   # one earlier upload, before the counter existed
    deps.store.delete("usagecounters", next(iter(deps.store._data["usagecounters"])))
    real_usage_query = deps.store.query
    pages = [[("files", (f"p{i}.jpg", photo(), "image/jpeg"))] for i in range(12)]
    with ThreadPoolExecutor(12) as pool:
        codes = list(pool.map(lambda files: upload(client, sid, files=files).status_code, pages))
    assert sorted(codes) == [201] * 9 + [402] * 3
    assert len(real_usage_query("submissions", "studentId", sid)) == 10
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["remaining"] == 0


def test_failed_upload_gives_its_slot_back(client, family, deps):
    sid = family["studentId"]

    class Broken:
        def scrub(self, data, fmt):
            raise RuntimeError("DLP down")

    good, deps.scrubber = deps.scrubber, Broken()
    assert upload(client, sid).status_code == 503
    deps.scrubber = good
    for _ in range(10):
        assert upload(client, sid).status_code == 201
    assert upload(client, sid).status_code == 402
    counter = deps.store.query("usagecounters", "studentId", sid)
    assert [c["count"] for c in counter] == [10]
    assert client.delete(f"/students/{sid}", headers=auth("alex")).status_code == 204
    assert deps.store.query("usagecounters", "studentId", sid) == []


def test_upload_without_tags_reads_course_and_topic_from_the_page(client, family):
    """Students no longer tag uploads: course and unit come from the reading step."""
    sid = family["studentId"]
    files = [("files", ("p1.jpg", photo(), "image/jpeg"))]
    r = client.post("/submissions", data={"studentId": sid, "sharpnessScore": "82"}, files=files, headers=auth("alex"))
    assert r.status_code == 201, r.text
    assert r.json()["unitTopic"] == ""
    done = client.post(f"/submissions/{r.json()['submissionId']}/process", headers=auth("alex")).json()
    assert done["submission"]["status"] == "GRADED"
    assert done["submission"]["unitTopic"] == "Completing the Square · Vertex form"
    assert done["submission"]["course"] == "MPM2D"


def test_one_unreadable_batch_job_does_not_block_the_others(deps, client):
    deps.store.put("batchjobs", "broken", {"name": "broken", "state": "SUBMITTED", "gradingIds": []})
    deps.store.put("batchjobs", "fine", {"name": "fine", "state": "SUBMITTED", "gradingIds": []})
    real = deps.batch.collect

    def collect(job):
        if job["name"] == "broken":
            raise RuntimeError("Vertex could not find the job")
        return real(job)

    deps.batch.collect = collect
    out = client.post("/internal/batch/worksheets/collect", headers={"X-Batch-Token": "s3cret"}).json()
    assert out["jobsWithErrors"] == 1
    assert deps.store.get("batchjobs", "fine")["state"] == "COLLECTED"
    assert deps.store.get("batchjobs", "broken")["state"] == "SUBMITTED"  # asked again next time


def test_make_the_worksheet_now(client, family, deps):
    """Pro students needn't wait for the night: the worksheet is made on request, the
    nightly job then leaves it alone, and a failure keeps it queued."""
    sid = family["studentId"]
    token = {"X-Batch-Token": "s3cret"}
    free = upload(client, sid).json()
    g_free = client.post(f"/submissions/{free['submissionId']}/process", headers=auth("alex")).json()["grading"]
    assert client.post(f"/gradings/{g_free['gradingId']}/worksheet/generate", headers=auth("alex")).status_code == 402

    client.post("/internal/users/alex/plan", json={"plan": "pro"}, headers=token)
    sub = upload(client, sid).json()
    g = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]
    url = f"/gradings/{g['gradingId']}/worksheet/generate"
    assert client.post(url, headers=auth("stranger")).status_code == 404

    real = deps.batch.generate_now
    deps.batch.generate_now = lambda item: (_ for _ in ()).throw(ValueError("step 2: is not true"))
    assert client.post(url, headers=auth("alex")).json()["detail"] == "WORKSHEET_NOT_MADE"
    assert deps.store.get("gradings", g["gradingId"])["worksheetStatus"] == "QUEUED"

    deps.batch.generate_now = real
    assert client.post("/internal/batch/worksheets/submit", headers=token).json()["submitted"] == 1
    made = client.post(url, headers=auth("alex")).json()  # while the nightly job is still out
    assert made["sectionB_FadedScaffolding"][1]["scaffoldingType"] == "PARTIAL_BLANK"
    again = client.post(url, headers=auth("jordan")).json()  # a parent can press it too; same sheet
    assert again["worksheetId"] == made["worksheetId"]
    client.post("/internal/batch/worksheets/collect", headers=token)
    assert client.get(f"/gradings/{g['gradingId']}/worksheet", headers=auth("alex")).json()["worksheetId"] == made["worksheetId"]
