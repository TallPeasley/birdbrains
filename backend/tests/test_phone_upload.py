"""Phone camera links: the QR code on every upload screen."""
from conftest import auth, photo, upload


def phone_files(n=1, w=1600):
    return [("files", (f"p{i}.jpg", photo(w, 1250 + i), "image/jpeg")) for i in range(n)]


def link(client, body, who="alex"):
    return client.post("/phone-uploads", json=body, headers=auth(who))


def test_phone_link_new_upload(client, family, deps):
    sid = family["studentId"]
    assert link(client, {"studentId": sid}, who="stranger").status_code in (403, 404)
    r = link(client, {"studentId": sid, "problem": "Find the distance between R(-5,-2) and S(7,3)."})
    assert r.status_code == 201, r.text
    t = r.json()
    sess_id, token = t["sessionId"], t["token"]
    assert t["maxFiles"] == 6
    stored = deps.store.get("phoneuploads", sess_id)
    assert token not in str(stored)  # only the hash is kept

    # The phone needs the secret; with it, it sees only what the link is for.
    assert client.get(f"/phone/{sess_id}").status_code == 404
    assert client.get(f"/phone/{sess_id}", headers={"X-Upload-Token": "wrong"}).status_code == 404
    seen = client.get(f"/phone/{sess_id}", headers={"X-Upload-Token": token}).json()
    assert seen["state"] == "WAITING" and seen["problem"].startswith("Find the distance") and seen["submissionId"] is None

    # A photo that fails the checks leaves the link open.
    bad = client.post(f"/phone/{sess_id}/photos", files=phone_files(w=640), headers={"X-Upload-Token": token})
    assert bad.status_code == 422 and bad.json()["code"] == 102

    done = client.post(f"/phone/{sess_id}/photos", files=phone_files(), data={"sharpnessScore": "80"},
                       headers={"X-Upload-Token": token})
    assert done.status_code == 200, done.text
    assert done.json()["state"] == "DONE" and done.json()["submissionId"] is None

    # The computer that made the link sees the submission and its grading.
    watched = client.get(f"/phone-uploads/{sess_id}", headers=auth("alex")).json()
    assert watched["state"] == "DONE" and watched["submissionId"]
    sub = deps.store.get("submissions", watched["submissionId"])
    assert sub["source"] == "phone" and sub["status"] == "GRADED" and sub["uploadedBy"] == "alex"
    assert client.get(f"/phone-uploads/{sess_id}", headers=auth("jordan")).status_code == 404

    # One use only.
    again = client.post(f"/phone/{sess_id}/photos", files=phone_files(), headers={"X-Upload-Token": token})
    assert again.status_code == 409 and again.json()["code"] == 305


def test_phone_link_expires_and_cancels(client, family, deps):
    sid = family["studentId"]
    t = link(client, {"studentId": sid}).json()
    hdr = {"X-Upload-Token": t["token"]}
    sess = deps.store.get("phoneuploads", t["sessionId"])
    deps.store.put("phoneuploads", t["sessionId"], sess | {"expiresAt": "2020-01-01T00:00:00+00:00"})
    assert client.get(f"/phone/{t['sessionId']}", headers=hdr).json()["state"] == "EXPIRED"
    r = client.post(f"/phone/{t['sessionId']}/photos", files=phone_files(), headers=hdr)
    assert r.status_code == 410 and r.json()["code"] == 304

    t2 = link(client, {"studentId": sid}).json()
    assert client.delete(f"/phone-uploads/{t2['sessionId']}", headers=auth("jordan")).status_code == 404
    assert client.delete(f"/phone-uploads/{t2['sessionId']}", headers=auth("alex")).status_code == 204
    r = client.post(f"/phone/{t2['sessionId']}/photos", files=phone_files(), headers={"X-Upload-Token": t2["token"]})
    assert r.status_code == 410


def test_phone_link_for_worksheet_problem_and_added_photos(client, family, deps):
    sid = family["studentId"]
    sub = upload(client, sid).json()
    g = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]

    # Worksheet problem: the upload remembers which worksheet and problem it answers.
    assert link(client, {"studentId": sid, "worksheetGradingId": "grd_nope"}).status_code == 404
    t = link(client, {"studentId": sid, "worksheetGradingId": g["gradingId"], "problem": "Section C"}).json()
    client.post(f"/phone/{t['sessionId']}/photos", files=phone_files(), headers={"X-Upload-Token": t["token"]})
    watched = client.get(f"/phone-uploads/{t['sessionId']}", headers=auth("alex")).json()
    rec = deps.store.get("submissions", watched["submissionId"])
    assert rec["forWorksheet"] == {"gradingId": g["gradingId"], "problem": "Section C"}

    # Add photos to the earlier upload from the phone: no new upload, same submission.
    assert link(client, {"kind": "addPhotos", "submissionId": sub["submissionId"]}, who="stranger").status_code in (403, 404)
    t = link(client, {"kind": "addPhotos", "submissionId": sub["submissionId"]}).json()
    assert t["maxFiles"] == 9
    r = client.post(f"/phone/{t['sessionId']}/photos", files=phone_files(2), headers={"X-Upload-Token": t["token"]})
    assert r.json()["state"] == "DONE", r.text
    assert len(deps.store.get("submissions", sub["submissionId"])["files"]) == 3


def test_web_upload_can_name_its_worksheet_problem(client, family, deps):
    sid = family["studentId"]
    sub = upload(client, sid).json()
    g = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()["grading"]
    r = upload(client, sid, data={"worksheetGradingId": g["gradingId"], "worksheetProblem": "Practice 3"})
    assert r.status_code == 201, r.text
    assert deps.store.get("submissions", r.json()["submissionId"])["forWorksheet"]["problem"] == "Practice 3"
