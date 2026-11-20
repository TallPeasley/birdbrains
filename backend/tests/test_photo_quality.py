"""Angled photos are straightened, known worksheets supply their printed questions,
and students can add more photos of the same page to an earlier upload."""
import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from birdbrains.known_worksheets import apply_known_worksheet, normalize_code
from birdbrains.photo_prep import find_page, straighten
from birdbrains.schemas import Stage1QuestionTranscription, Stage1TranscriptionOutput
from conftest import auth, photo, upload

cv2 = pytest.importorskip("cv2")


def angled_page(w=2000, h=1600) -> bytes:
    """A white page with ruled lines on a dark desk, seen at an angle."""
    page = Image.new("RGB", (1100, 1400), "white")
    draw = ImageDraw.Draw(page)
    for y in range(100, 1350, 60):
        draw.line([(80, y), (1020, y)], fill="black", width=4)
    src = np.float32([[0, 0], [1099, 0], [1099, 1399], [0, 1399]])
    dst = np.float32([[600, 100], [1400, 180], [1480, 1500], [520, 1450]])
    m = cv2.getPerspectiveTransform(src, dst)
    desk = np.full((h, w, 3), (40, 50, 70), np.uint8)
    warped = cv2.warpPerspective(np.array(page), m, (w, h), dst=desk, borderMode=cv2.BORDER_TRANSPARENT)
    out = io.BytesIO()
    Image.fromarray(warped).save(out, format="JPEG", quality=95)
    return out.getvalue()


def test_an_angled_page_is_found_and_flattened():
    data = angled_page()
    gray = cv2.cvtColor(np.array(Image.open(io.BytesIO(data)).convert("RGB")), cv2.COLOR_RGB2GRAY)
    assert find_page(gray) is not None
    flat = Image.open(io.BytesIO(straighten(data, "JPEG")))
    # Cropped to the page (portrait, no desk) and never below the 1080p floor.
    assert flat.height > flat.width and min(flat.size) >= 1080
    corner = np.array(flat.convert("L"))[5:40, 5:40].mean()
    assert corner > 150  # paper, not the dark desk


def test_a_photo_without_page_edges_is_left_alone():
    data = photo()  # plain image, e.g. a close-up of one question
    assert straighten(data, "JPEG") == data


def test_bad_bytes_never_break_an_upload():
    assert straighten(b"not an image", "JPEG") == b"not an image"


def test_worksheet_codes_are_normalised():
    for raw in ("BB-W12", "bb w12", "BB–W12", "BB-W 012"):
        assert normalize_code(raw) == "BB-W12"
    assert normalize_code("") == "" and normalize_code("Unit 3") == ""


def test_a_known_sheet_supplies_its_printed_questions():
    read = Stage1TranscriptionOutput(
        submission_id="s", overall_ocr_confidence=0.6, detected_worksheet_code="BB-W12",
        questions=[Stage1QuestionTranscription(question_number="4", problem_statement="A kite strng 5O m ..."),
                   Stage1QuestionTranscription(question_number="9", problem_statement="extra")])
    out = apply_known_worksheet(read)
    assert out.questions[0].problem_statement.startswith("A kite string 50 m long")
    assert out.questions[1].problem_statement == "extra"  # not on the sheet: kept as read
    assert len(out.questions) == 2  # questions not in the photo are not invented


def test_an_unknown_code_changes_nothing():
    read = Stage1TranscriptionOutput(submission_id="s", overall_ocr_confidence=0.9, detected_worksheet_code="XY-1",
                                     questions=[Stage1QuestionTranscription(question_number="1", problem_statement="p")])
    assert apply_known_worksheet(read) == read


def test_adding_photos_regrades_with_all_of_them(client, family, deps):
    deps.free_monthly_limit = 1
    sid = family["studentId"]
    same = photo()
    sub = upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).json()["submissionId"]
    first = client.post(f"/submissions/{sub}/process", headers=auth("alex")).json()["grading"]
    ledger_before = deps.store.get("ledgers", sid)
    # The same photo again plus a close-up: allowed, and no new monthly upload is used.
    r = client.post(f"/submissions/{sub}/photos", headers=auth("alex"),
                    files=[("files", ("a.jpg", same, "image/jpeg")), ("files", ("b.jpg", photo(), "image/jpeg"))])
    assert r.status_code == 200, r.text
    out = r.json()
    assert len(out["submission"]["fileUrls"]) == 3
    assert out["grading"]["gradingId"] != first["gradingId"]
    assert deps.store.get("gradings", first["gradingId"]) is None
    assert deps.store.get("ledgers", sid) == ledger_before  # the same work is not counted twice
    assert client.get(f"/students/{sid}/usage", headers=auth("alex")).json()["remaining"] == 0


def test_adding_photos_has_limits(client, family):
    sid = family["studentId"]
    sub = upload(client, sid).json()["submissionId"]
    other = client.post(f"/submissions/{sub}/photos", headers=auth("stranger"),
                        files=[("files", ("a.jpg", photo(), "image/jpeg"))])
    assert other.status_code in (403, 404)
    too_many = [("files", (f"{i}.jpg", photo(), "image/jpeg")) for i in range(10)]
    assert client.post(f"/submissions/{sub}/photos", headers=auth("alex"), files=too_many).status_code == 422
    small = client.post(f"/submissions/{sub}/photos", headers=auth("alex"),
                        files=[("files", ("s.jpg", photo(800, 600), "image/jpeg"))])
    assert small.status_code == 422
    for _ in range(3):
        assert client.post(f"/submissions/{sub}/photos", headers=auth("alex"),
                           files=[("files", ("a.jpg", photo(), "image/jpeg"))]).status_code == 200
    assert client.post(f"/submissions/{sub}/photos", headers=auth("alex"),
                       files=[("files", ("a.jpg", photo(), "image/jpeg"))]).status_code == 422
