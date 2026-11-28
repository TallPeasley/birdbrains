"""Slides and textbook pages from the student portal (POST /submissions/batch)."""
import io

import pytest
from PIL import Image

from birdbrains.documents import pptx_parts, sniff

from conftest import auth, upload

PDF = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"


def png(w=800, h=600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "white").save(buf, "PNG")
    return buf.getvalue()


def deck(*slides: str, picture: bool = False) -> bytes:
    from pptx import Presentation
    from pptx.util import Inches

    prs = Presentation()
    for text in slides:
        slide = prs.slides.add_slide(prs.slide_layouts[5])  # title only
        slide.shapes.title.text = text
        if picture:
            slide.shapes.add_picture(io.BytesIO(png(64, 64)), Inches(1), Inches(2))
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def send(client, sid, mode="SLIDES_DECK", files=None, uid="alex", topic="Unit 6 · Equations", **extra):
    files = files if files is not None else [("files", ("unit6.pdf", PDF, "application/pdf"))]
    data = {"studentId": sid, "uploadMode": mode, "unitTopic": topic} | extra
    return client.post("/submissions/batch", data=data, files=files, headers=auth(uid))


# ------------------------------------------------------------------ file sniffing
def test_sniff_by_bytes_not_name():
    assert sniff(PDF).kind == "pdf"
    assert sniff(deck("Hi")).kind == "pptx"
    assert sniff(png()).kind == "image" and sniff(png()).mime == "image/png"
    assert sniff(b"PK\x03\x04not really a zip") is None
    assert sniff(b"hello") is None
    # A .docx is a zip too, but not a deck.
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", "<w/>")
    assert sniff(buf.getvalue()) is None


def test_pptx_parts_has_text_and_pictures():
    parts = pptx_parts(deck("Solving 2x + 3 = 7", "Two-step equations", picture=True))
    assert "Solving 2x + 3 = 7" in parts[0].text and "--- Slide 2 ---" in parts[0].text
    assert [p.mime for p in parts[1:]] == ["image/png", "image/png"]


# ------------------------------------------------------------------ routes
def test_slides_batch_end_to_end(client, family):
    sid = family["studentId"]
    files = [("files", ("lesson.pptx", deck("Linear equations"), "application/octet-stream")),
             ("files", ("booklet.pdf", PDF, "application/pdf")),
             ("files", ("screenshot.png", png(), "image/png"))]
    r = send(client, sid, files=files)
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["batchId"].startswith("bat_") and b["status"] == "UPLOADED" and b["uploadMode"] == "SLIDES_DECK"
    assert [f["mimeType"] for f in b["files"]] == [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf", "image/png"]
    assert b["course"] == "MPM2D"  # the student's own course when none is sent

    done = client.post(f"/submissions/batch/{b['batchId']}/process", headers=auth("alex")).json()
    assert done["status"] == "READY" and done["finishedAt"]
    assert done["practice"]["title"].startswith("Practice:")
    assert {p["difficulty"] for p in done["practice"]["problems"]} == {"WARM_UP", "CORE", "STRETCH"}
    # Idempotent, and readable by GET and by a linked parent.
    again = client.post(f"/submissions/batch/{b['batchId']}/process", headers=auth("alex")).json()
    assert again == done
    assert client.get(f"/submissions/batch/{b['batchId']}", headers=auth("jordan")).json()["status"] == "READY"
    listed = client.get(f"/students/{sid}/batches", headers=auth("alex")).json()
    assert [x["batchId"] for x in listed] == [b["batchId"]]


def test_textbook_batch_gives_hints_not_answers(client, family):
    r = send(client, family["studentId"], mode="TEXTBOOK_ASSIST",
             files=[("files", ("page12.png", png(), "image/png"))], topic="Chapter 4 · Linear systems")
    done = client.post(f"/submissions/batch/{r.json()['batchId']}/process", headers=auth("alex")).json()
    assert done["status"] == "READY" and done["practice"] is None
    hint = done["textbookHints"][0]
    assert hint["label"] and 1 <= len(hint["hints"]) <= 4 and hint["check"]


def test_unreadable_files_fail_with_207(client, family):
    r = send(client, family["studentId"], files=[("files", ("blank.pptx", deck("UNREADABLE"), "application/octet-stream"))])
    done = client.post(f"/submissions/batch/{r.json()['batchId']}/process", headers=auth("alex")).json()
    assert done["status"] == "FAILED" and done["failureCode"] == 207


def test_engine_error_fails_with_a_5xx_code(client, family, deps):
    class Broken:
        def slides_practice(self, *a):
            raise TimeoutError("deadline")

        textbook_hints = slides_practice

    deps.documents = Broken()
    from birdbrains.api import create_app
    from fastapi.testclient import TestClient

    c = TestClient(create_app(deps))
    r = send(c, family["studentId"])
    bid = r.json()["batchId"]
    done = c.post(f"/submissions/batch/{bid}/process", headers=auth("alex")).json()
    assert done["status"] == "FAILED" and 500 <= done["failureCode"] < 600

    # A failure on our side can be retried on the same batch, at no extra upload.
    used = c.get(f"/students/{family['studentId']}/usage", headers=auth("alex")).json()["usedThisMonth"]
    from birdbrains.documents import FakeDocumentEngine

    deps.documents = FakeDocumentEngine()
    c = TestClient(create_app(deps))
    again = c.post(f"/submissions/batch/{bid}/process", headers=auth("alex")).json()
    assert again["status"] == "READY" and again["failureCode"] is None and again["practice"]["problems"]
    assert c.get(f"/students/{family['studentId']}/usage", headers=auth("alex")).json()["usedThisMonth"] == used


def test_a_run_that_died_part_way_can_be_retried(client, family, deps):
    bid = send(client, family["studentId"]).json()["batchId"]
    rec = deps.store.get("batches", bid)
    deps.store.put("batches", bid, rec | {"status": "GENERATING", "startedAt": "2026-01-01T00:00:00+00:00"})
    done = client.post(f"/submissions/batch/{bid}/process", headers=auth("alex")).json()
    assert done["status"] == "READY"
    # A run still in progress is left alone.
    deps.store.put("batches", bid, deps.store.get("batches", bid) | {"status": "READING", "startedAt": "2999-01-01T00:00:00+00:00"})
    assert client.post(f"/submissions/batch/{bid}/process", headers=auth("alex")).json()["status"] == "READING"


@pytest.mark.parametrize("mode, files, code", [
    ("SLIDES_DECK", [("files", ("notes.docx", b"PK\x03\x04junk", "application/octet-stream"))], 105),
    ("TEXTBOOK_ASSIST", [("files", ("deck.pptx", deck("x"), "application/octet-stream"))], 105),  # no decks here
    ("TEXTBOOK_ASSIST", [("files", (f"p{i}.pdf", PDF, "application/pdf")) for i in range(11)], 107),
    ("SLIDES_DECK", [], 107),
])
def test_bad_uploads_are_refused_with_codes(client, family, mode, files, code):
    r = send(client, family["studentId"], mode=mode, files=files)
    assert r.status_code == 422
    if files:  # FastAPI rejects an empty file list before our handler runs
        assert r.json()["code"] == code


def test_size_limits(client, family, monkeypatch):
    from birdbrains import api

    monkeypatch.setattr(api, "BATCH_MAX_FILE_BYTES", 100)
    r = send(client, family["studentId"])  # the PDF is a little over 50 bytes: fine
    assert r.status_code == 201
    big = PDF + b"0" * 200
    r = send(client, family["studentId"], files=[("files", ("big.pdf", big, "application/pdf"))])
    assert r.status_code == 413 and r.json()["code"] == 106
    monkeypatch.setattr(api, "BATCH_MAX_FILE_BYTES", 10_000)
    monkeypatch.setattr(api, "BATCH_MAX_TOTAL_BYTES", 150)
    two = [("files", (f"{i}.pdf", PDF + b"0" * 60, "application/pdf")) for i in range(2)]
    r = send(client, family["studentId"], files=two)
    assert r.status_code == 413 and "30 MB" in r.json()["detail"]


def test_topic_and_subject_are_required(client, family):
    assert send(client, family["studentId"], topic="").status_code == 422
    # Science courses are not gradable yet.
    client.patch("/me", json={"name": "Alex Mercer", "course": "ngss.g8.science"}, headers=auth("alex"))
    r = send(client, family["studentId"])
    assert r.status_code == 422 and r.json()["code"] == 109


def test_only_the_student_and_linked_parent_can_see_a_batch(client, family):
    bid = send(client, family["studentId"]).json()["batchId"]
    assert client.get(f"/submissions/batch/{bid}", headers=auth("stranger")).status_code == 404
    assert client.post(f"/submissions/batch/{bid}/process", headers=auth("stranger")).status_code == 404
    assert client.get(f"/students/{family['studentId']}/batches", headers=auth("stranger")).status_code == 404
    assert send(client, family["studentId"], uid="stranger").status_code == 404


def test_a_batch_counts_as_one_free_upload(client, family, deps):
    deps.free_monthly_limit = 2
    sid = family["studentId"]
    assert upload(client, sid).status_code == 201  # one photo upload
    r = send(client, sid, files=[("files", (f"{i}.pdf", PDF, "application/pdf")) for i in range(3)])
    assert r.status_code == 201  # three files, one upload
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["usedThisMonth"] == 2
    r = send(client, sid)
    assert r.status_code == 402 and r.json()["code"] == 402


def test_images_are_scrubbed_before_storage(client, family, deps):
    seen = []
    real = deps.scrubber.scrub

    def spy(data, fmt):
        seen.append(fmt)
        return real(data, fmt)

    deps.scrubber.scrub = spy
    send(client, family["studentId"], files=[("files", ("a.png", png(), "image/png")),
                                             ("files", ("b.pdf", PDF, "application/pdf"))])
    assert seen == ["PNG"]  # the PDF is stored as sent


def test_deleting_the_student_removes_batches(client, family, deps):
    sid = family["studentId"]
    bid = send(client, sid).json()["batchId"]
    assert deps.store.get("batches", bid)
    assert client.delete(f"/students/{sid}", headers=auth("jordan")).status_code == 204
    assert deps.store.get("batches", bid) is None
    with pytest.raises(Exception):
        deps.storage.read_bytes(f"submissions/{sid}/batches/{bid}/0.pdf")
