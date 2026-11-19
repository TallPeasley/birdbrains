"""Free-plan pipeline mode, cost metering, worksheet checks, the accuracy harness,
progress/class reports and the privacy audit (no names reach the model or logs)."""
import json
import logging
from types import SimpleNamespace

import pytest

from ai_eval.__main__ import main as eval_main
from ai_eval.gold import load_gold
from ai_eval.metrics import F1, SampleResult, consistency_problems, percentile, summarise
from ai_eval.runner import markdown_report, run_all
from birdbrains import batch_engine as B
from birdbrains import pipeline as P
from birdbrains.fake import FakePipeline, fake_worksheet
from birdbrains.math_lint import lint_math, lint_worksheet
from birdbrains.schemas import PillarEnum, ScaffoldingModeEnum
from conftest import auth, upload
from test_billing_classroom import TOKEN, FakeClassroom
from test_pipeline import CTX, S1, S2, StubClient

GOLD = "ai_eval/gold/synthetic.jsonl"


# ------------------------------------------------------------ Free pipeline mode
def test_free_mode_uses_flash_without_thinking_or_mood():
    client = StubClient()
    meter = P.Meter()
    out = P.GeminiPipeline(client=client).run_stage2(CTX, S1, plan="free", meter=meter)
    model, contents, config = client.calls[0]
    assert model == "gemini-3.5-flash" == client.cache_model       # its own cache, not Pro's
    assert config.thinking_config.thinking_level.value == "MINIMAL"
    assert contents.startswith("Plan: FREE")
    # The stub returned mood data anyway; none of it survives on Free.
    assert out.sentiment_entities == [] and out.aggregate_valence == 0 and out.aggregate_friction == 0
    assert out.recommended_scaffolding_mode is ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE
    assert out.identified_errors == S2.identified_errors and out.pillar_scores == S2.pillar_scores
    assert meter.calls[0].model == "gemini-3.5-flash"


def test_pro_and_free_keep_separate_caches(monkeypatch):
    monkeypatch.setattr(P, "STAGE2_MODEL", "pro-model")  # Pro and Free use different models only when configured so
    client = StubClient()
    pipe = P.GeminiPipeline(client=client)
    for plan in ("pro", "free", "pro", "free"):
        pipe.run_stage2(CTX, S1, plan=plan)
    assert client.cache_creates == 2
    assert [c[0] for c in client.calls] == ["pro-model", "gemini-3.5-flash"] * 2


def test_meter_prices_tokens(monkeypatch):
    usage = SimpleNamespace(prompt_token_count=3000, cached_content_token_count=2000,
                            candidates_token_count=500, thoughts_token_count=1500)
    meter = P.Meter()
    meter.record("stage2", "gemini-2.5-pro", 0.0, SimpleNamespace(usage_metadata=usage))
    # 1000 fresh in + 2000 cached in + 2000 out (thinking is billed as output)
    assert meter.usd == pytest.approx((1000 * 1.25 + 2000 * 0.125 + 2000 * 10.0) / 1e6)
    assert meter.summary()["calls"][0]["outputTokens"] == 2000
    monkeypatch.setenv("BIRDBRAINS_PRICES_JSON", '{"gemini-2.5-pro": [2, 1, 20]}')
    assert meter.usd == pytest.approx((1000 * 2 + 2000 * 1 + 2000 * 20) / 1e6)
    unknown = P.Meter()
    unknown.record("stage1", "fake", 0.0)
    assert unknown.usd == 0


def test_grading_records_cost_but_never_returns_it(client, family, deps, capsys):
    seen = []
    real = deps.pipeline.run_stage2
    deps.pipeline.run_stage2 = lambda ctx, s1, plan="pro", meter=None: seen.append(plan) or real(ctx, s1, plan, meter)
    sub = upload(client, family["studentId"]).json()
    out = client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex")).json()
    assert seen == ["free"] and "cost" not in out["grading"]
    stored = deps.store.get("gradings", out["grading"]["gradingId"])
    assert [c["stage"] for c in stored["cost"]["calls"]] == ["stage1", "stage2"]
    line = next(json.loads(l) for l in capsys.readouterr().out.splitlines() if '"pipeline_done"' in l)
    assert line["plan"] == "free" and set(line) == {"severity", "event", "plan", "submissionId", "usd", "seconds"}


# ------------------------------------------------------------- worksheet checks
@pytest.mark.parametrize("text,problem", [
    ("y = 2(x + 3)^2 - 18 + 5", None),
    ("y = 3(x^2 + 4x + [ __ ] - [ __ ]) + 1", None),
    (r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", None),
    ("It costs $5 and $8", None),
    ("y = 2(x + 3^2 - 4", "unclosed"),
    ("y = 2x + 3) - 4", "unbalanced"),
    ("the price is $5", "odd number of $"),
    ("x^ + 3", "nothing after"),
    (r"\fracc{1}{2}", "unknown LaTeX command"),
    (r"\begin{aligned} x &= 1", "without a matching"),
])
def test_lint_math(text, problem):
    found = lint_math(text)
    assert (found == []) if problem is None else any(problem in f for f in found), found


def test_broken_worksheets_are_retried_not_shown():
    good = fake_worksheet(None)
    assert lint_worksheet(good) == []
    steps = good.faded_scaffolding
    broken = {
        "first step not GIVEN": good.model_copy(update={"faded_scaffolding": steps[1:]}),
        "blank without answer": good.model_copy(update={"faded_scaffolding": [
            steps[0], steps[1].model_copy(update={"blank_placeholder": None}), *steps[2:]]}),
        "no blank": good.model_copy(update={"faded_scaffolding": [
            steps[0], steps[1].model_copy(update={"given_content": "y = 3(x^2 + 4x + 4 - 4) + 1"}), *steps[2:]]}),
        "bad maths": good.model_copy(update={"target_concept": "Expand 2(x + 3"}),
        "no mirror": good.model_copy(update={"diagnostic_mirror": []}),
        "mirror points at text not in the line": good.model_copy(update={"diagnostic_mirror": [
            good.diagnostic_mirror[0].model_copy(update={"wrong_part": "- 7"})]}),
    }
    for name, ws in broken.items():
        assert lint_worksheet(ws), name

    def row(gid, ws):
        return json.dumps({"grading_id": gid, "response": {"candidates": [{"content": {"parts": [
            {"text": ws.model_dump_json()}]}}]}})

    done, failed = B.parse_output_jsonl(row("grd_ok", good) + "\n" + row("grd_bad", broken["bad maths"]))
    assert list(done) == ["grd_ok"] and failed == ["grd_bad"]


# ------------------------------------------------------------- accuracy harness
class KeyedEngine:
    """Grades each gold sample from an answer table, so the scoring can be checked."""

    def __init__(self, answers):
        self.answers = answers

    def run_stage1(self, ctx, images, meter=None):
        return S1

    def run_stage2(self, ctx, stage1, plan="pro", meter=None):
        codes, cf_ok = self.answers[ctx.submission_id]
        if codes == "boom":
            raise ValueError("model returned invalid JSON")
        steps = [S2.step_evaluations[0].model_copy(update={"step_number": l.line_number, "student_latex": l.raw_latex,
                                                           "is_correct": cf_ok}) for l in stage1.lines]
        errors = [S2.identified_errors[0].model_copy(update={"error_code": c, "pillar": PillarEnum(c[:3])}) for c in codes]
        return S2.model_copy(update={"submission_id": ctx.submission_id, "step_evaluations": steps,
                                     "identified_errors": errors + [S2.identified_errors[1]]})


def test_gold_set_loads_and_covers_the_codes():
    gold = load_gold(GOLD)
    assert len(gold) == 22 and len({s.id for s in gold}) == 22
    codes = {c for s in gold for c in s.root_codes}
    assert len(codes) == 15 and "TST-04" not in codes
    assert sum(1 for s in gold if not s.root_codes) == 3          # fully correct work is in the set too
    for s in gold:
        assert all(1 < n <= len(s.lines) for n in s.carry_forward_steps), s.id
        assert all(lint_math(line) == [] for line in s.lines), s.id


def test_gold_file_errors_name_the_line(tmp_path):
    f = tmp_path / "g.jsonl"
    f.write_text('# comment\n{"id": "x", "course": "MPM2D", "unit_topic": "t", "lines": ["x"], '
                 '"expected": {"root_codes": ["XYZ-09"]}}\n')
    with pytest.raises(ValueError, match="g.jsonl line 2: unknown error code"):
        load_gold(f)


def test_metrics():
    gold = load_gold(GOLD)
    perfect = run_all(KeyedEngine({s.id: (sorted(s.root_codes), True) for s in gold}), gold, "pro")
    s = summarise(perfect)
    assert (s.schema_pass_rate, s.pillar_f1, s.code_f1, s.exact_match_rate, s.carry_forward_accuracy) == (1, 1, 1, 1, 1)
    assert all(s.gates().values()) and s.carry_forward_lines == 18

    answers = {x.id: (sorted(x.root_codes), True) for x in gold}
    answers["S-10"] = (["PRC-03"], False)       # right pillar family? no: FAC-01 expected, PRC-03 given
    answers["S-17"] = (["FAC-01"], True)        # an error invented on correct work
    answers["S-01"] = ("boom", True)            # schema failure
    answers["S-09"] = (["PRC-01"], True)        # right pillar, wrong code
    worse = summarise(run_all(KeyedEngine(answers), gold, "pro"))
    assert worse.schema_pass_rate == pytest.approx(21 / 22)
    assert worse.exact_match_rate == pytest.approx(18 / 22)
    assert worse.code_f1 < worse.pillar_f1 < 1                    # S-09 costs code F1 only
    assert worse.carry_forward_accuracy == pytest.approx(16 / 18)  # S-10's line and S-01's line
    assert worse.per_code["FAC-01"].fp == 1 and worse.per_code["PRC-04"].fn == 1
    assert not worse.gates()["Schema pass rate 100%"]
    report = markdown_report(worse, run_all(KeyedEngine(answers), gold, "pro"), "pro", "keyed", "synthetic")
    assert "**S-17**" in report and "label says no errors; the model said FAC-01" in report and "FAIL: Schema" in report

    f = F1(tp=3, fp=1, fn=2)
    assert (f.precision, f.recall) == (0.75, 0.6) and f.f1 == pytest.approx(2 / 3)
    assert percentile([float(i) for i in range(1, 21)], 0.95) == 19 and percentile([], 0.95) == 0
    assert consistency_problems(S2) == []
    wrong_pillar = S2.model_copy(update={"identified_errors": [S2.identified_errors[0].model_copy(update={"pillar": PillarEnum.CON})]})
    assert "PRC-03 filed under pillar CON" in consistency_problems(wrong_pillar)[0]


def test_cli_writes_reports(tmp_path, capsys):
    assert eval_main(["--gold", GOLD, "--engine", "fake", "--out", str(tmp_path), "--limit", "5"]) == 0
    assert eval_main(["--gold", GOLD, "--engine", "fake", "--out", str(tmp_path), "--plan", "free", "--strict"]) == 1
    data = json.loads((tmp_path / "accuracy-free.json").read_text())
    assert data["samples"] == 22 and (tmp_path / "accuracy-pro.md").read_text().startswith("# BirdBrains accuracy report")
    assert "[free] 22 samples" in capsys.readouterr().out


# ---------------------------------------------------------------------- reports
def test_student_progress_report(client, family):
    sid = family["studentId"]
    empty = client.get(f"/students/{sid}/progress", headers=auth("alex")).json()
    assert empty["uploads"] == 0 and empty["timeline"] == [] and empty["averageMastery"] is None
    for _ in range(2):
        sub = upload(client, sid).json()
        client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    rep = client.get(f"/students/{sid}/progress", headers=auth("jordan")).json()     # the linked parent can read it
    assert rep["uploads"] == 2 and rep["plan"] == "free" and rep["studentName"] == "Alex Mercer"
    assert rep["errorCodes"] == [{"code": "PRC-03", "name": "Algebraic Manipulation / Sign Failure", "pillar": "PRC",
                                  "count": 2, "students": 1, "lastSeen": rep["lastUploadAt"]}]
    assert rep["recurringCodes"] == ["PRC-03"]
    assert [p["rootErrors"] for p in rep["timeline"]] == [1, 1] and rep["timeline"][0]["valence"] is None  # Free: no mood
    assert rep["masteryByStrand"] == [{"strandName": "Quadratic Relations", "mastery": 0.8}]
    assert {p["pillar"]: p["percentageOfTotalErrors"] for p in rep["pillarErrorDistribution"]}["PRC"] == 100
    assert client.get(f"/students/{sid}/progress", headers=auth("stranger")).status_code == 404

    client.post("/internal/users/jordan/plan", json={"plan": "pro"}, headers=TOKEN)
    sub = upload(client, sid).json()
    client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    pro = client.get(f"/students/{sid}/progress", headers=auth("alex")).json()
    assert pro["plan"] == "pro" and pro["timeline"][-1]["valence"] is not None


def test_teacher_class_report(client, family, deps):
    client.post("/me", json={"role": "teacher", "name": "Ms. Rivera"}, headers=auth("rivera"))
    assert client.get("/teacher/report", headers=auth("jordan")).status_code == 403
    assert client.get("/teacher/report", headers=auth("rivera")).json()["detail"] == "PRO_ONLY"
    client.post("/internal/users/rivera/plan", json={"plan": "pro"}, headers=TOKEN)
    assert client.get("/teacher/report", headers=auth("rivera")).json()["students"] == []

    deps.classroom = FakeClassroom()
    state = client.post("/classroom/connect", headers=auth("rivera")).json()["url"].split("state=")[1]
    client.get(f"/classroom/callback?state={state}&code=good", follow_redirects=False)
    res = client.post("/classroom/courses/c1/coursework/w1/import", json={"course": "MPM2D", "unitTopic": "Quadratic Relations"},
                      headers=auth("rivera")).json()
    ana = res["imported"][0]
    client.post(f"/submissions/{ana['submissionId']}/process", headers=auth("rivera"))

    rep = client.get("/teacher/report?googleCourseId=c1", headers=auth("rivera")).json()
    assert rep["uploads"] == 1 and [s["studentName"] for s in rep["students"]] == ["Ana Silva", "Ben Okoro"]
    row = rep["students"][0]
    assert row["topCode"] == "PRC-03" and row["averageMastery"] == 0.8 and not row["needsAttention"]
    assert rep["students"][1]["uploads"] == 0 and rep["students"][1]["averageMastery"] is None
    assert rep["errorCodes"][0]["code"] == "PRC-03" and rep["errorCodes"][0]["students"] == 1
    assert client.get("/teacher/report?googleCourseId=other", headers=auth("rivera")).json()["students"] == []
    one = client.get(f"/students/{ana['studentId']}/progress", headers=auth("rivera")).json()
    assert one["plan"] == "pro" and one["timeline"][0]["valence"] is not None


# ---------------------------------------------------------------- privacy audit
def test_no_names_reach_the_model_the_batch_file_or_the_logs(client, family, deps, caplog, capsys):
    """Launch privacy audit: student and parent names and sign-in ids stay in the
    account records. Prompts, batch request files and log lines carry opaque ids only."""
    caplog.set_level(logging.DEBUG)
    client.post("/internal/users/jordan/plan", json={"plan": "pro"}, headers=TOKEN)
    sent = []
    real1, real2 = deps.pipeline.run_stage1, deps.pipeline.run_stage2

    def stage1(ctx, images, meter=None):
        sent.append(repr(ctx))
        return real1(ctx, images, meter)

    def stage2(ctx, s1, plan="pro", meter=None):
        sent.append(P.stage2_prompt(ctx, s1, plan))
        return real2(ctx, s1, plan, meter)

    deps.pipeline.run_stage1, deps.pipeline.run_stage2 = stage1, stage2
    submitted = []
    real_submit = deps.batch.submit
    deps.batch.submit = lambda items: submitted.append(B.build_jsonl(items)) or real_submit(items)

    sub = upload(client, family["studentId"]).json()
    client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    assert client.post("/internal/batch/worksheets/submit", headers=TOKEN).json()["submitted"] == 1
    client.post("/internal/batch/worksheets/collect", headers=TOKEN)

    logs = [r.getMessage() for r in caplog.records if r.name.startswith("birdbrains")] + [capsys.readouterr().out]
    assert "pipeline_done" in logs[-1]
    outbound = "\n".join(sent + submitted + logs)
    assert len(sent) == 2 and len(submitted) == 1
    for private in ("Alex", "Mercer", "Jordan", family["studentId"], family["linkCode"], "alex", "jordan"):
        assert private not in outbound, private
    assert P.VERTEX_LOCATION == "northamerica-northeast1"
    assert "Never transcribe people's names" in P.STAGE1_SYSTEM


# ---------------------------------------------------------- daily pilot summary
def test_internal_stats_has_numbers_but_no_names_or_ids(client, family, deps):
    assert client.get("/internal/stats").status_code == 401
    sid = family["studentId"]
    sub = upload(client, sid).json()
    client.post(f"/submissions/{sub['submissionId']}/process", headers=auth("alex"))
    upload(client, sid)
    s = client.get("/internal/stats?days=1", headers=TOKEN).json()
    assert s["newAccounts"] == {"student": 1, "parent": 2}
    assert s["uploads"] == 2 and s["uploadsByStatus"] == {"GRADED": 1, "UPLOADED": 1}
    assert s["activeStudents"] == 1 and s["activeStudentsByPlan"] == {"free": 1} and s["freeStudentsAtCap"] == 0
    assert s["graded"] == 1 and s["gradedByPlan"] == {"free": 1} and s["gradedWithNoErrors"] == 0
    assert s["topErrorCodes"] == [{"code": "PRC-03", "count": 1}] and s["worksheets"] == {"PRO_ONLY": 1}
    text = json.dumps(s)
    for private in ("Alex", "Mercer", "Jordan", sid, sub["submissionId"]):
        assert private not in text

    from tools.pilot_summary import render
    out = render(s)
    assert "Uploads: 2 from 1 students (1 free)" in out and "1 x PRC-03 Algebraic Manipulation" in out
    old = deps.store.get("submissions", sub["submissionId"]) | {"uploadedAt": "2026-01-01T00:00:00+00:00"}
    deps.store.put("submissions", sub["submissionId"], old)
    assert client.get("/internal/stats", headers=TOKEN).json()["uploads"] == 1


def test_mirror_shows_the_step_before_and_the_wrong_part():
    """Section A shows the move that went wrong (two lines) and points at the exact piece."""
    from birdbrains.projections import to_api_worksheet

    content = fake_worksheet(None)
    api = to_api_worksheet({"worksheetId": "ws_1", "gradingId": "g_1", "content": content.model_dump(mode="json")})
    m = api.sectionA_DiagnosticMirror[0]
    assert m.previousStepText == "y = 2(x^2 + 6x + 9 - 9) + 5"
    assert m.wrongPart in m.originalStepText and m.correctPart == "- 18"
    assert m.whatWentWrong
    # Worksheets saved before these fields existed still load.
    old = content.model_dump(mode="json")
    for k in ("previous_step_text", "wrong_part", "correct_part", "what_went_wrong"):
        old["diagnostic_mirror"][0].pop(k)
    assert to_api_worksheet({"worksheetId": "ws_2", "gradingId": "g_2", "content": old}).sectionA_DiagnosticMirror[0].previousStepText == ""
