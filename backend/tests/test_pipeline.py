import pytest
"""GeminiPipeline and the batch engine against a stub client: checks the requests
we build (models, thinking budget, cache use, location, per-question isolation,
answer keys, key-step checks, re-substitution verification) without calling Vertex."""
import json

from birdbrains.schemas import WorksheetContent
import re
from types import SimpleNamespace

from birdbrains import batch_engine as B
from birdbrains import pipeline as P
from birdbrains.fake import FakePipeline, fake_worksheet
from birdbrains.projections import to_api_grading
from birdbrains.schemas import (
    CourseEnum,
    QuestionGradingOutput,
    ScaffoldingModeEnum,
    Stage1TranscriptionOutput,
    Stage2GradingAndAffectOutput,
)
from birdbrains.storage import LocalStorage

CTX = P.SubmissionContext("sub_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square")
FAKE = FakePipeline()
S1 = FAKE.run_stage1(CTX, [])
S2 = FAKE.run_stage2(CTX, S1)
Q1 = S2.question_analyses[0]


class StubClient:
    def __init__(self, cache_ok=True, question_outputs=None):
        self.calls, self.cache_creates, self.cache_ok = [], 0, cache_ok
        self._question_outputs = question_outputs or {}
        self.models = SimpleNamespace(generate_content=self._generate)
        self.caches = SimpleNamespace(create=self._cache)
        self.batches = SimpleNamespace(create=self._batch, get=lambda name: SimpleNamespace(
            state=SimpleNamespace(name="JOB_STATE_SUCCEEDED")))

    def _generate(self, model, contents, config):
        self.calls.append((model, contents, config))
        schema_name = config.response_schema.__name__
        if schema_name.startswith("Stage1"):
            return SimpleNamespace(text=S1.model_copy(update={"submission_id": "model-made-this-up"}).model_dump_json())
        if schema_name == "QuestionGradingOutput":
            prompt_text = contents if isinstance(contents, str) else str(contents)
            for qnum, out in self._question_outputs.items():
                if f"question_number: {qnum}\n" in prompt_text:
                    res = out(prompt_text) if callable(out) else out
                    return SimpleNamespace(text=res.model_dump_json())
            return SimpleNamespace(text=Q1.model_dump_json())
        return SimpleNamespace(text=S2.model_copy(update={"submission_id": "model-made-this-up"}).model_dump_json())

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
    assert model == "gemini-3.5-flash"
    assert config.thinking_config.thinking_level.value == "MINIMAL"
    assert contents[0].parts[0].file_data.file_uri == "gs://b/p.jpg"
    assert "NEVER correct" in config.system_instruction
    assert "problem_statement" in config.system_instruction
    assert config.response_schema.__name__ == "Stage1VisionOutput"
    assert out.submission_id == CTX.submission_id and not out.requires_hitl
    assert len(out.questions) == 1 and len(out.questions[0].lines) == 5


def test_stage1_low_confidence_goes_to_hitl():
    client = StubClient()
    low = S1.model_copy(update={"overall_ocr_confidence": 0.4})
    client.models.generate_content = lambda **k: SimpleNamespace(text=low.model_dump_json())
    assert P.GeminiPipeline(client=client).run_stage1(CTX, [P.ImageRef("gs://b/p.jpg", "image/jpeg")]).requires_hitl


def test_stage2_uses_cache_and_thinking_level():
    client = StubClient()
    pipe = P.GeminiPipeline(client=client)
    out = pipe.run_stage2(CTX, S1)
    pipe.run_stage2(CTX, S1)
    model, contents, config = client.calls[0]
    assert model == "gemini-3.5-flash" == client.cache_model
    assert config.cached_content == "cachedContents/123" and config.system_instruction is None
    assert config.thinking_config.thinking_level.value == "LOW"
    assert config.response_schema is QuestionGradingOutput
    assert client.cache_creates == 1 and client.cache_config.ttl == "86400s"
    assert "CON-01" in client.cache_config.contents[0].parts[0].text
    assert out.submission_id == CTX.submission_id
    assert len(out.question_analyses) == 1
    assert out.question_analyses[0].answer_key.final_answer
    assert out.question_analyses[0].final_answer_verification.satisfies_initial_question is False


def test_stage2_falls_back_to_inline_taxonomy():
    client = StubClient(cache_ok=False)
    pipe = P.GeminiPipeline(client=client)
    pipe.run_stage2(CTX, S1)
    pipe.run_stage2(CTX, S1)
    _, contents, config = client.calls[0]
    assert config.cached_content is None and "PRC-03" in contents and config.system_instruction
    assert client.cache_creates == 1  # not retried on every request


def test_small_taxonomy_skips_the_cache_call(monkeypatch):
    monkeypatch.setattr(P, "CACHE_MIN_CHARS", 10**9)  # the real size: under Vertex's 4,096-token floor
    client = StubClient()
    P.GeminiPipeline(client=client).run_stage2(CTX, S1)
    assert client.cache_creates == 0
    _, contents, config = client.calls[0]
    assert config.cached_content is None and "PRC-03" in contents


def test_stage2_separates_multi_question_analysis_and_isolates_carry_forward():
    multi_s1 = Stage1TranscriptionOutput.model_validate({
        "submission_id": CTX.submission_id,
        "overall_ocr_confidence": 0.95,
        "requires_hitl": False,
        "questions": [
            {
                "question_number": "1",
                "problem_statement": "1. Solve by elimination: 5x - 2y = 16 and 3x + 4y = 20.",
                "lines": [
                    {"line_number": 1, "raw_latex": "10x - 4y = 32", "bounding_box_normalized": [0.1, 0.1, 0.4, 0.15],
                     "confidence_score": 0.95, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                    {"line_number": 2, "raw_latex": "3x + 4y = 20", "bounding_box_normalized": [0.1, 0.15, 0.4, 0.2],
                     "confidence_score": 0.95, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                    {"line_number": 3, "raw_latex": "7x = 12", "bounding_box_normalized": [0.1, 0.2, 0.4, 0.25],
                     "confidence_score": 0.95, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                    {"line_number": 4, "raw_latex": "x = \\frac{12}{7}", "bounding_box_normalized": [0.1, 0.25, 0.4, 0.3],
                     "confidence_score": 0.95, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                ],
            },
            {
                "question_number": "2",
                "problem_statement": "2. Solve 2x + 6 = 14.",
                "lines": [
                    {"line_number": 1, "raw_latex": "2x = 8", "bounding_box_normalized": [0.1, 0.5, 0.4, 0.55],
                     "confidence_score": 0.98, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                    {"line_number": 2, "raw_latex": "x = 4", "bounding_box_normalized": [0.1, 0.55, 0.4, 0.6],
                     "confidence_score": 0.98, "visual_affect_markers": ["CLEAN_CONTINUOUS_FLOW"]},
                ],
            },
        ],
    })

    q1_resp = QuestionGradingOutput.model_validate({
        "question_number": "1",
        "problem_statement": "1. Solve by elimination: 5x - 2y = 16 and 3x + 4y = 20.",
        "answer_key": {
            "method_used": "Elimination",
            "steps": [
                {"step_number": 1, "description": "Multiply Eq. 1 by 2", "expected_math": "10x - 4y = 32", "is_key_step": True},
                {"step_number": 2, "description": "Add equations to eliminate y", "expected_math": "13x = 52", "is_key_step": True},
                {"step_number": 3, "description": "Solve for x and y", "expected_math": "x = 4, y = 2", "is_key_step": True},
            ],
            "final_answer": "x = 4, y = 2",
            "answer_verification": "5(4) - 2(2) = 16 and 3(4) + 4(2) = 20.",
        },
        "final_answer_verification": {
            "student_final_answer": "x = 12/7",
            "resubstitution_check": "Substituting x = 12/7 gives y = -26/7 from Eq. 1, which fails Eq. 2: 3(12/7)+4(-26/7) = -68/7 != 20.",
            "satisfies_initial_question": False,
            "discrepancy_note": "Failed equation 2 because the two equations were subtracted instead of added.",
        },
        "key_step_checks": [
            {"key_step_number": 1, "key_step_description": "Multiply Eq. 1 by 2", "expected_math": "10x - 4y = 32",
             "status": "PRESENT", "matched_student_steps": [1], "note": "Scaled equation 1 accurately."},
            {"key_step_number": 2, "key_step_description": "Add equations to eliminate y", "expected_math": "13x = 52",
             "status": "PRESENT_WITH_ERROR", "matched_student_steps": [3], "note": "Subtracted 10x - 3x and 32 - 20 instead of adding."},
            {"key_step_number": 3, "key_step_description": "Solve for x and y", "expected_math": "x = 4, y = 2",
             "status": "MISSING", "matched_student_steps": [], "note": "Did not finish solving for y."},
        ],
        "step_evaluations": [
            {"step_number": 1, "student_latex": "10x - 4y = 32", "is_correct": True, "is_carry_forward_consistent": False,
             "pillar": None, "error_code": None, "explanation": "Correctly doubled equation 1."},
            {"step_number": 2, "student_latex": "3x + 4y = 20", "is_correct": True, "is_carry_forward_consistent": False,
             "pillar": None, "error_code": None, "explanation": "Copied equation 2 accurately."},
            {"step_number": 3, "student_latex": "7x = 12", "is_correct": False, "is_carry_forward_consistent": False,
             "pillar": "PRC", "error_code": "PRC-03", "explanation": "To eliminate -4y and +4y, add the equations (13x = 52), do not subtract."},
            {"step_number": 4, "student_latex": "x = \\frac{12}{7}", "is_correct": True, "is_carry_forward_consistent": True,
             "pillar": "PRC", "error_code": "PRC-03", "explanation": "Follows validly from step 3."},
        ],
        "identified_errors": [
            {"pillar": "PRC", "error_code": "PRC-03", "description": "Subtracted x-terms and constants while cancelling opposite-sign y-terms.",
             "target_entity": "elimination addition vs subtraction", "is_cascading_consequence": False, "severity": "HIGH"},
        ],
        "pillar_scores": [
            {"pillar": "CON", "max_score": 2, "earned_score": 2, "feedback": "Good setup for elimination."},
            {"pillar": "STR", "max_score": 2, "earned_score": 2, "feedback": "Elimination was a good choice."},
            {"pillar": "PRC", "max_score": 2, "earned_score": 0.5, "feedback": "Add equations when y-coefficients have opposite signs."},
            {"pillar": "FAC", "max_score": 2, "earned_score": 2, "feedback": "Arithmetic followed your chosen operation."},
            {"pillar": "COM", "max_score": 1, "earned_score": 1, "feedback": "Work is clearly laid out."},
            {"pillar": "TST", "max_score": 1, "earned_score": 1, "feedback": "You finished the question."},
        ],
        "sentiment_entities": [],
        "aggregate_valence": 0.1,
        "aggregate_friction": 0.3,
        "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
        "supportive_framing_message": "Good start multiplying equation 1 by 2; remember to add when signs are opposite.",
        "parent_insight": "Have them write a big + sign beside the stacked equations before eliminating.",
    })

    # Deliberately set a bogus carry-forward flag on Q2 step 1 to verify sanitization strips it.
    q2_resp = QuestionGradingOutput.model_validate({
        "question_number": "2",
        "problem_statement": "2. Solve 2x + 6 = 14.",
        "answer_key": {
            "method_used": "Inverse operations",
            "steps": [
                {"step_number": 1, "description": "Subtract 6 from both sides", "expected_math": "2x = 8", "is_key_step": True},
                {"step_number": 2, "description": "Divide by 2", "expected_math": "x = 4", "is_key_step": True},
            ],
            "final_answer": "x = 4",
            "answer_verification": "2(4) + 6 = 14.",
        },
        "final_answer_verification": {
            "student_final_answer": "x = 4",
            "resubstitution_check": "2(4) + 6 = 8 + 6 = 14 (verified).",
            "satisfies_initial_question": True,
            "discrepancy_note": "",
        },
        "key_step_checks": [
            {"key_step_number": 1, "key_step_description": "Subtract 6", "expected_math": "2x = 8",
             "status": "PRESENT", "matched_student_steps": [1], "note": "Shown accurately."},
            {"key_step_number": 2, "key_step_description": "Divide by 2", "expected_math": "x = 4",
             "status": "PRESENT", "matched_student_steps": [2], "note": "Shown accurately."},
        ],
        "step_evaluations": [
            {"step_number": 1, "student_latex": "2x = 8", "is_correct": True, "is_carry_forward_consistent": True,
             "pillar": None, "error_code": None, "explanation": "Subtracted 6 correctly."},
            {"step_number": 2, "student_latex": "x = 4", "is_correct": True, "is_carry_forward_consistent": False,
             "pillar": None, "error_code": None, "explanation": "Divided by 2 correctly."},
        ],
        "identified_errors": [],
        "pillar_scores": [
            {"pillar": "CON", "max_score": 2, "earned_score": 2, "feedback": "Solid."},
            {"pillar": "STR", "max_score": 2, "earned_score": 2, "feedback": "Good plan."},
            {"pillar": "PRC", "max_score": 2, "earned_score": 2, "feedback": "Clean steps."},
            {"pillar": "FAC", "max_score": 2, "earned_score": 2, "feedback": "Accurate."},
            {"pillar": "COM", "max_score": 1, "earned_score": 1, "feedback": "Clear."},
            {"pillar": "TST", "max_score": 1, "earned_score": 1, "feedback": "Complete."},
        ],
        "sentiment_entities": [],
        "aggregate_valence": 0.8,
        "aggregate_friction": 0.0,
        "recommended_scaffolding_mode": "STANDARD_PROGRESSIVE_FADE",
        "supportive_framing_message": "Clean and accurate solution!",
        "parent_insight": "Strong confidence on two-step linear equations.",
    })

    client = StubClient(question_outputs={"1": q1_resp, "2": q2_resp})
    out = P.GeminiPipeline(client=client).run_stage2(CTX, multi_s1)

    # Two isolated Stage 2 calls: Q1 prompt never includes Q2 and vice versa.
    assert len(client.calls) == 2
    prompts = [c[1] for c in client.calls]
    assert any("10x - 4y = 32" in p and "2x + 6 = 14" not in p for p in prompts)
    assert any("2x + 6 = 14" in p and "10x - 4y = 32" not in p for p in prompts)

    # Separated per question; flat step_evaluations is empty on multi-question sheets.
    assert [q.question_number for q in out.question_analyses] == ["1", "2"]
    assert out.step_evaluations == []
    assert out.question_analyses[0].step_evaluations[3].is_carry_forward_consistent is True
    # Bogus carry-forward flag on Q2 step 1 was sanitized out.
    assert out.question_analyses[1].step_evaluations[0].is_carry_forward_consistent is False

    # API projection keeps questionAnalyses separated; the page-wide step list tags every
    # step with its question and restarts the numbering in each question.
    api_view = to_api_grading({
        "gradingId": "grd_abcdefghijkl",
        "submissionId": CTX.submission_id,
        "studentId": "stu_abcdefghijkl",
        "unitTopic": "Mixed Practice",
        "scaffoldingMode": "STANDARD_PROGRESSIVE_FADE",
        "gradedAt": "2026-11-18T20:00:00+00:00",
        "plan": "pro",
        "stage2": out.model_dump(mode="json"),
    })
    assert len(api_view.questionAnalyses) == 2
    steps = api_view.stepDiagnostics
    assert [s.stepNumber for s in steps] == list(range(1, len(steps) + 1))
    for qa in api_view.questionAnalyses:
        mine = [s for s in steps if s.questionLabel == qa.questionNumber]
        assert [s.questionStepNumber for s in mine] == [s.stepNumber for s in qa.stepDiagnostics]
    assert [(q.label, q.text) for q in api_view.questions] == [
        (qa.questionNumber, qa.problemStatement) for qa in api_view.questionAnalyses]
    assert api_view.totalScore == 18.5 and api_view.maxPossibleScore == 20.0
    assert api_view.questionAnalyses[0].finalAnswerVerification.satisfiesInitialQuestion is False
    assert api_view.questionAnalyses[1].finalAnswerVerification.satisfiesInitialQuestion is True


def test_stage2_retries_when_resubstitution_contradicts_all_correct_steps():
    # First attempt contradicts itself: re-sub failed, yet all steps marked correct and zero root errors.
    broken = Q1.model_copy(update={
        "step_evaluations": [s.model_copy(update={"is_correct": True, "is_carry_forward_consistent": False,
                                                  "pillar": None, "error_code": None}) for s in Q1.step_evaluations],
        "identified_errors": [],
        "key_step_checks": [c.model_copy(update={"status": "PRESENT"}) for c in Q1.key_step_checks],
    })
    attempts = [0]

    def responder(_prompt):
        attempts[0] += 1
        return broken if attempts[0] == 1 else Q1

    client = StubClient(question_outputs={"1": responder})
    out = P.GeminiPipeline(client=client).run_stage2(CTX, S1)
    assert attempts[0] == 2
    assert "SELF-CHECK FAILURE" in client.calls[1][1]
    assert [e.error_code for e in out.identified_errors if not e.is_cascading_consequence] == ["PRC-03"]


def test_legacy_stage1_and_stage2_remain_compatible():
    legacy_s1 = Stage1TranscriptionOutput.model_validate({
        "submission_id": CTX.submission_id,
        "overall_ocr_confidence": 0.9,
        "lines": [l.model_dump(mode="json") for l in S1.lines],
        "requires_hitl": False,
    })
    resolved = legacy_s1.resolved_questions()
    assert len(resolved) == 1 and len(resolved[0].lines) == 5

    legacy_s2_dict = S2.model_dump(mode="json")
    legacy_s2_dict.pop("question_analyses")
    legacy_s2 = Stage2GradingAndAffectOutput.model_validate(legacy_s2_dict)
    assert legacy_s2.question_analyses == [] and len(legacy_s2.step_evaluations) == 5
    api_view = to_api_grading({
        "gradingId": "grd_abcdefghijkl",
        "submissionId": CTX.submission_id,
        "studentId": "stu_abcdefghijkl",
        "unitTopic": "Completing the Square",
        "scaffoldingMode": "STANDARD_PROGRESSIVE_FADE",
        "gradedAt": "2026-11-18T20:00:00+00:00",
        "plan": "pro",
        "stage2": legacy_s2.model_dump(mode="json"),
    })
    assert api_view.questionAnalyses == [] and len(api_view.stepDiagnostics) == 5


def test_batch_round_trip(tmp_path):
    item = B.FlaggedGrading("grd_abcdefghijkl", CourseEnum.MPM2D, "Completing the Square",
                            ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE, S2)
    assert B.is_flagged(S2)
    line = json.loads(B.build_jsonl([item]).strip())
    assert line["grading_id"] == "grd_abcdefghijkl"
    prompt = line["request"]["contents"][0]["parts"][0]["text"]
    assert "PRC-03" in prompt and "vertex form constant" not in prompt  # cascading errors are left out
    assert line["request"]["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "LOW"}
    # Vertex loads the file through BigQuery: every key a valid column name ("$ref" and
    # "$defs" failed every real job), nesting under BigQuery's 15 levels.
    def keys(o, depth=1):
        if isinstance(o, dict):
            for k, v in o.items():
                yield k, depth
                yield from keys(v, depth + 1)
        elif isinstance(o, list):
            for v in o:
                yield from keys(v, depth)
    bad = [k for k, _ in keys(line) if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,299}", k)]
    assert bad == [] and max(d for _, d in keys(line)) <= 15
    schema = line["request"]["generationConfig"]["responseJsonSchema"]
    # Every required field is still described ("title" is a field name, not only a keyword).
    def objects(o):
        if isinstance(o, dict):
            if "properties" in o:
                yield o
            for v in o.values():
                yield from objects(v)
        elif isinstance(o, list):
            for v in o:
                yield from objects(v)
    for obj in objects(schema):
        assert set(obj.get("required", [])) <= set(obj["properties"]), obj.get("required")
    assert set(schema["properties"]) == set(WorksheetContent.model_fields)
    assert schema["properties"]["practice_set"]["items"]["properties"]["difficulty"]["enum"] == ["WARM_UP", "CORE", "STRETCH"]

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


def test_busy_vertex_is_retried_then_sent_inline(monkeypatch):
    """429/5xx from Vertex: retry with waits, then try once without the cached context."""
    monkeypatch.setattr(P.time, "sleep", lambda s: None)

    class Busy(Exception):
        code = 429

    client = StubClient()
    real = client._generate
    seen = []

    def flaky(model, contents, config):
        seen.append(bool(config.cached_content))
        if config.cached_content:
            raise Busy("RESOURCE_EXHAUSTED")
        return real(model, contents, config)

    client.models.generate_content = flaky
    out = P.GeminiPipeline(client=client).run_stage2(CTX, S1)
    assert out.question_analyses
    assert seen == [True] * (len(P.RETRY_WAITS) + 1) + [False]


def test_non_transient_errors_are_not_retried(monkeypatch):
    monkeypatch.setattr(P.time, "sleep", lambda s: None)
    calls = []

    def bad():
        calls.append(1)
        raise ValueError("bad schema")

    with pytest.raises(ValueError):
        P.with_retries(bad, "x")
    assert calls == [1]
