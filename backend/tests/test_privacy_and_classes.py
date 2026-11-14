import io

from PIL import Image

from conftest import auth, photo, upload
from birdbrains.privacy import Box, PhotoScrubber


def _page_with_header(exif=True):
    """White page; a 'handwritten' header line (thin stripes) at y 40..70, and a body line at y 600..630."""
    img = Image.new("RGB", (1600, 1200), "white")
    for x in range(100, 1500, 4):
        img.paste((0, 0, 0), (x, 40, x + 2, 70))
        img.paste((0, 0, 0), (x, 600, x + 2, 630))
    ex = Image.Exif()
    if exif:
        ex[0x8825] = {2: (43.0, 39.0, 0.0)}  # GPSInfo
        ex[0x0110] = "Pixel 9"
    buf = io.BytesIO()
    img.save(buf, "PNG", exif=ex)
    return buf.getvalue()


class FakeDlp:
    """Finds a printed "Name:" label at the left of the header line."""

    def __init__(self):
        self.calls = 0

    def detect(self, data, fmt):
        self.calls += 1
        return [Box("HEADER_FIELD_LABEL", 100, 42, 60, 26)]


def _stripes_visible(img, y):
    row = [img.getpixel((x, y))[0] for x in range(600, 700)]
    return max(row) - min(row) > 200


def test_scrubber_blurs_detected_fields_and_drops_exif():
    out = PhotoScrubber(FakeDlp()).scrub(_page_with_header(), "PNG")
    with Image.open(io.BytesIO(out)) as img:
        assert not img.getexif()
        assert not _stripes_visible(img, 55)   # header value after the label: blurred to the right edge
        assert _stripes_visible(img, 615)      # the maths further down is untouched


def test_no_detector_leaves_page_alone_but_strips_exif():
    out = PhotoScrubber().scrub(_page_with_header(), "PNG")
    with Image.open(io.BytesIO(out)) as img:
        assert not img.getexif() and _stripes_visible(img, 55)


def test_stored_photo_is_scrubbed(client, family, deps):
    deps.scrubber.detector = FakeDlp()
    sid = family["studentId"]
    sub = upload(client, sid, files=[("files", ("p.png", _page_with_header(), "image/png"))]).json()
    r = client.get(sub["fileUrls"][0], headers=auth("alex"))
    assert r.headers["cache-control"] == "private, max-age=900"
    with Image.open(io.BytesIO(r.content)) as img:
        assert not img.getexif() and not _stripes_visible(img, 55) and _stripes_visible(img, 615)


def test_dlp_failure_stores_nothing(client, family, deps):
    class Broken:
        def detect(self, data, fmt):
            raise RuntimeError("DLP down")

    deps.scrubber.detector = Broken()
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
