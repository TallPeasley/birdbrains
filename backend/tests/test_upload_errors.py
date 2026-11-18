import io
import re
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

from birdbrains.fake import FakePipeline
from birdbrains.schemas import Stage1TranscriptionOutput
from birdbrains.upload_errors import UPLOAD_ERRORS, classify_pipeline_error
from conftest import auth, photo, upload


def code_of(r):
    return r.json()["code"]


def test_photo_problems_carry_codes_and_a_next_step(client, family):
    sid = family["studentId"]
    r = upload(client, sid, data={"sharpnessScore": "10"})
    assert r.status_code == 422 and code_of(r) == 101 and r.json()["retake"] is True and "detail" in r.json()
    r = upload(client, sid, files=[("files", ("s.jpg", photo(640, 480), "image/jpeg"))])
    assert code_of(r) == 102
    r = upload(client, sid, files=[("files", ("x.jpg", b"not an image", "image/jpeg"))])
    assert code_of(r) == 104
    buf = io.BytesIO(); Image.new("RGB", (1600, 1200)).save(buf, "BMP")
    assert code_of(upload(client, sid, files=[("files", ("x.bmp", buf.getvalue(), "image/bmp"))])) == 105
    same = photo()
    assert upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))]).status_code == 201
    dup = upload(client, sid, files=[("files", ("a.jpg", same, "image/jpeg"))])
    assert dup.status_code == 409 and code_of(dup) == 108 and dup.headers["location"].startswith("/submissions/")


def test_free_limit_keeps_its_detail_and_gains_a_code(client, family, deps):
    deps.free_monthly_limit = 1
    sid = family["studentId"]
    assert upload(client, sid).status_code == 201
    r = upload(client, sid)
    assert r.status_code == 402 and r.json()["detail"] == "FREE_LIMIT_REACHED" and code_of(r) == 402


def test_unreadable_page_reports_why(client, family, deps):
    class Pipe(FakePipeline):
        def run_stage1(self, ctx, images, meter=None):
            out = super().run_stage1(ctx, images, meter)
            return out.model_copy(update={"requires_hitl": True, "unreadable_reason": "QUESTIONS_NOT_VISIBLE"})

    deps.pipeline = Pipe()
    sub = upload(client, family["studentId"]).json()
    done = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert done["submission"]["status"] == "NEEDS_RETAKE" and done["submission"]["failureCode"] == 204


def test_unreadable_page_without_a_reason_is_201(client, family, deps):
    class Pipe(FakePipeline):
        def run_stage1(self, ctx, images, meter=None):
            return super().run_stage1(ctx, images, meter).model_copy(update={"requires_hitl": True})

    deps.pipeline = Pipe()
    sub = upload(client, family["studentId"]).json()
    done = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert done["submission"]["failureCode"] == 201


def test_grading_failures_map_to_5xx_codes(client, family, deps):
    class Boom(FakePipeline):
        def run_stage2(self, *a, **k):
            raise TimeoutError("slow")

    deps.pipeline = Boom()
    sub = upload(client, family["studentId"]).json()
    r = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    assert r.status_code == 502 and code_of(r) == 503 and r.json()["ours"] is True
    assert deps.store.get("submissions", sub["submissionId"])["failureCode"] == 503


def test_classify_pipeline_error():
    http = lambda c, msg="": type("ClientError", (Exception,), {"code": c})(msg)
    assert classify_pipeline_error(http(404)) == 501        # model retired or not in this region
    assert classify_pipeline_error(http(403)) == 501
    assert classify_pipeline_error(http(429)) == 502
    assert classify_pipeline_error(http(504)) == 503
    assert classify_pipeline_error(ValueError("bad json")) == 504
    assert classify_pipeline_error(RuntimeError("?")) == 505


def test_codes_are_unique_and_in_series():
    for code, info in UPLOAD_ERRORS.items():
        assert code == info.code and 100 <= code <= 999 and info.title and info.message and info.action
    assert Stage1TranscriptionOutput.model_fields["unreadable_reason"]


def test_frontend_table_matches_backend():
    ts = (Path(__file__).parents[2] / "lib" / "uploadErrors.ts").read_text()
    assert set(map(int, re.findall(r"^\s{2}(\d{3}): \{", ts, re.M))) == set(UPLOAD_ERRORS)
