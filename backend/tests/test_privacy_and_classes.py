import io

from PIL import Image

from conftest import auth, photo, upload
from birdbrains.privacy import PhotoScrubber


def _jpeg_with_gps():
    img = Image.new("RGB", (1600, 1200), "white")
    exif = Image.Exif()
    exif[0x8825] = {2: (43.0, 39.0, 0.0)}  # GPSInfo
    exif[0x0110] = "Pixel 9"  # camera model
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def test_scrubber_masks_header_and_drops_exif():
    out = PhotoScrubber().scrub(_jpeg_with_gps(), "JPEG")
    with Image.open(io.BytesIO(out)) as img:
        assert not img.getexif()
        assert img.getpixel((800, 50)) < (20, 20, 20)        # inside the top 12%: black
        assert img.getpixel((800, 600)) > (235, 235, 235)    # body of the page untouched


def test_stored_photo_is_scrubbed(client, family):
    sid = family["studentId"]
    sub = upload(client, sid, files=[("files", ("p.jpg", _jpeg_with_gps(), "image/jpeg"))]).json()
    r = client.get(sub["fileUrls"][0], headers=auth("alex"))
    assert r.headers["cache-control"] == "private, max-age=900"
    with Image.open(io.BytesIO(r.content)) as img:
        assert not img.getexif() and img.getpixel((800, 50)) < (20, 20, 20)


def test_dlp_failure_stores_nothing(client, family, deps):
    class Broken:
        def redact(self, data, fmt):
            raise RuntimeError("DLP down")

    deps.scrubber.redactor = Broken()
    assert upload(client, family["studentId"]).status_code == 503
    assert deps.store.query("submissions", "studentId", family["studentId"]) == []


def test_profile_and_classes(client, family):
    token = {"X-Batch-Token": "s3cret"}
    school = client.post("/internal/schools", json={"schoolName": "Maple High"}, headers=token).json()
    assert school["tenantId"].startswith("ten_")
    assert client.post(f"/internal/schools/{school['schoolId']}/classes",
                       json={"className": "10A Math", "gradeLevel": 2}, headers=token).status_code == 422
    cls = client.post(f"/internal/schools/{school['schoolId']}/classes",
                      json={"className": "10A Math", "gradeLevel": 10}, headers=token).json()
    assert client.post("/internal/schools", json={"schoolName": "x"}).status_code == 401

    joined = client.post("/me/classes", json={"joinCode": cls["joinCode"].lower()}, headers=auth("alex")).json()
    assert joined == [{"classId": cls["classId"], "className": "10A Math", "gradeLevel": 10,
                       "schoolId": school["schoolId"], "schoolName": "Maple High"}]
    assert client.post("/me/classes", json={"joinCode": "ZZZZZZ"}, headers=auth("alex")).status_code == 404
    assert client.post("/me/classes", json={"joinCode": cls["joinCode"]}, headers=auth("jordan")).status_code == 403
    assert client.get("/me", headers=auth("alex")).json()["classIds"] == [cls["classId"]]
    assert client.delete(f"/me/classes/{cls['classId']}", headers=auth("alex")).json() == []

    assert client.patch("/me", json={"name": "Alex M."}, headers=auth("alex")).json()["name"] == "Alex M."


def test_other_tenant_records_are_hidden(client, family, deps):
    sub = upload(client, family["studentId"]).json()
    rec = deps.store.get("submissions", sub["submissionId"])
    deps.store.put("submissions", sub["submissionId"], rec | {"tenantId": "ten_otherschool"})
    assert client.get(f"/submissions/{sub['submissionId']}", headers=auth("alex")).status_code == 404


def test_parent_deletes_child_data(client, family, deps):
    sid = family["studentId"]
    sub = upload(client, sid).json()
    client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    assert client.delete(f"/students/{sid}", headers=auth("stranger")).status_code == 404
    assert client.delete(f"/students/{sid}", headers=auth("jordan")).status_code == 204

    for coll in ("submissions", "gradings", "users"):
        assert deps.store.query(coll, "studentId", sid) == []
    assert deps.store.get("ledgers", sid) is None
    assert deps.store.get("linkcodes", family["linkCode"]) is None
    assert client.get("/me", headers=auth("jordan")).json()["childStudentIds"] == []
    assert client.get("/me", headers=auth("alex")).status_code == 403  # account gone
    assert deps.storage.read_texts(f"submissions/{sid}/", "") == []


def test_delete_me(client, family):
    assert client.delete("/me", headers=auth("jordan")).status_code == 204
    assert client.get("/me", headers=auth("jordan")).status_code == 403
    assert client.delete("/me", headers=auth("alex")).status_code == 204
    assert client.get("/me", headers=auth("alex")).status_code == 403
