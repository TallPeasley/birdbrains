"""GeminiPipeline and the batch engine against a stub client: checks the requests
we build (models, thinking budget, cache use, location) without calling Vertex."""
import json
from types import SimpleNamespace

from birdbrains import batch_engine as B
from birdbrains import pipeline as P
from birdbrains.fake import FakePipeline, fake_worksheet
from birdbrains.schemas import CourseEnum, ScaffoldingModeEnum
from birdbrains.storage import LocalStorage

CTX = P.SubmissionContext("sub_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square")
FAKE = FakePipeline()
S1 = FAKE.run_stage1(CTX, [])
S2 = FAKE.run_stage2(CTX, S1)


class StubClient:
    def __init__(self, cache_ok=True):
        self.calls, self.cache_creates, self.cache_ok = [], 0, cache_ok
        self.models = SimpleNamespace(generate_content=self._generate)
        self.caches = SimpleNamespace(create=self._cache)
        self.batches = SimpleNamespace(create=self._batch, get=lambda name: SimpleNamespace(
            state=SimpleNamespace(name="JOB_STATE_SUCCEEDED")))

    def _generate(self, model, contents, config):
        self.calls.append((model, contents, config))
        body = S1 if model == P.STAGE1_MODEL else S2
        return SimpleNamespace(text=body.model_copy(update={"submission_id": "model-made-this-up"}).model_dump_json())

    def _cache(self, model, config):
        self.cache_creates += 1
        if not self.cache_ok:
            raise RuntimeError("too small to cache")
        self.cache_model, self.cache_config = model, config
        return SimpleNamespace(name="cachedContents/123")

    def _batch(self, model, src, config):
        self.batch = (model, src, config)
        return SimpleNamespace(name="projects/p/locations/l/batchPredictionJobs/9")


def test_location_is_locked_to_montreal():
    assert P.VERTEX_LOCATION == "northamerica-northeast1"


def test_stage1_request():
    client = StubClient()
    out = P.GeminiPipeline(client=client).run_stage1(CTX, [P.ImageRef("gs://b/p.jpg", "image/jpeg")])
    model, contents, config = client.calls[0]
    assert model == "gemini-2.5-flash"
    assert contents[0].parts[0].file_data.file_uri == "gs://b/p.jpg"
    assert "NEVER correct" in config.system_instruction
    assert out.submission_id == CTX.submission_id and not out.requires_hitl


def test_stage1_low_confidence_goes_to_hitl():
    client = StubClient()
    low = S1.model_copy(update={"overall_ocr_confidence": 0.4})
    client.models.generate_content = lambda **k: SimpleNamespace(text=low.model_dump_json())
    assert P.GeminiPipeline(client=client).run_stage1(CTX, [P.ImageRef("gs://b/p.jpg", "image/jpeg")]).requires_hitl


def test_stage2_uses_cache_and_thinking_budget():
    client = StubClient()
    pipe = P.GeminiPipeline(client=client)
    out = pipe.run_stage2(CTX, S1)
    pipe.run_stage2(CTX, S1)
    model, contents, config = client.calls[0]
    assert model == "gemini-2.5-pro" == client.cache_model
    assert config.cached_content == "cachedContents/123" and config.system_instruction is None
    assert config.thinking_config.thinking_budget == 2048
    assert client.cache_creates == 1 and client.cache_config.ttl == "86400s"
    assert "CON-01" in client.cache_config.contents[0].parts[0].text
    assert out.submission_id == CTX.submission_id


def test_stage2_falls_back_to_inline_taxonomy():
    client = StubClient(cache_ok=False)
    pipe = P.GeminiPipeline(client=client)
    pipe.run_stage2(CTX, S1)
    pipe.run_stage2(CTX, S1)
    _, contents, config = client.calls[0]
    assert config.cached_content is None and "PRC-01" in contents and config.system_instruction
    assert client.cache_creates == 1  # not retried on every request


def test_batch_round_trip(tmp_path):
    item = B.FlaggedGrading("grd_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square",
                            ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE, S2)
    assert B.is_flagged(S2)
    line = json.loads(B.build_jsonl([item]).strip())
    assert line["grading_id"] == "grd_abcdefghijkl"
    prompt = line["request"]["contents"][0]["parts"][0]["text"]
    assert "PRC-01" in prompt and "vertex form constant" not in prompt  # cascading errors are left out

    storage, client = LocalStorage(str(tmp_path)), StubClient()
    engine = B.GeminiBatchEngine(storage, client=client)
    job = engine.submit([item])
    model, src, config = client.batch
    assert src.endswith("requests.jsonl") and config.dest.endswith("/output/")
    assert engine.submit([]) is None

    ok = {"grading_id": "grd_abcdefghijkl", "response": {"candidates": [{"content": {"parts": [
        {"text": fake_worksheet(item).model_dump_json()}]}}]}}
    bad = {"grading_id": "grd_bad", "response": {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}}
    storage.write_text(job["outputPrefix"] + "prediction/predictions.jsonl", json.dumps(ok) + "\n" + json.dumps(bad))
    done, failed = engine.collect(job)
    assert list(done) == ["grd_abcdefghijkl"] and failed == ["grd_bad"]
