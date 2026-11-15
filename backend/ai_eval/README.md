# Accuracy harness (`ai_eval`)

Runs a labelled gold set through the grading pipeline and writes a report with:
schema pass rate, pillar F1, error-code F1, carry-forward accuracy, the share of
samples graded exactly right, P50/P95 time per upload and cost per upload. It runs
the Pro path (Gemini Pro with thinking and mood) and the Free path (Flash only)
separately, so each plan's accuracy and cost are known.

```bash
cd backend
python -m ai_eval --gold ai_eval/gold/synthetic.jsonl --engine fake      # checks the harness, no cloud
python -m ai_eval --gold ai_eval/gold/synthetic.jsonl --gold ai_eval/gold/photos.jsonl \
  --engine gemini --plan both --out ai_eval/reports                       # real Vertex AI calls
```

`--engine gemini` needs Google credentials with the Vertex AI User role and
`GOOGLE_CLOUD_PROJECT=birdbrain-514606` (Cloud Shell has both after
`pip install -r requirements.txt`). Reports land in `ai_eval/reports/accuracy-pro.md`
and `accuracy-free.md` (plus `.json`). `--strict` exits 1 when a release gate fails.

## Gates

| Measure | Gate | When |
|---|---|---|
| Samples graded exactly right | 85% on 25 samples | Phase 2 exit, Nov 24 |
| Schema pass rate | 100% | Release, Dec 10 |
| Pillar F1 | 0.92 | Release |
| Error-code F1 | 0.88 | Release |
| Carry-forward accuracy | 95% | Release |
| P95 time per upload | under 14 s | E2E-01 |

How each is counted:
- **Schema pass**: the model's JSON validated and passed the consistency rules
  (code matches its pillar, one score per pillar, score not above its maximum).
- **Pillar / code F1**: micro-averaged over samples, comparing the set of root-cause
  codes a tutor gave with the set the model gave. Cascading consequences are ignored.
  An error invented on correct work counts against precision.
- **Carry-forward accuracy**: of the lines labelled "only wrong because of an earlier
  mistake", the share the model left unpenalised (`is_correct = true`).

## Gold set format

One JSON object per line in a `.jsonl` file under `ai_eval/gold/`:

```json
{"id": "G-001", "course": "MPM2D", "unit_topic": "Completing the Square",
 "images": ["photos/G-001.jpg"],
 "expected": {"root_codes": ["PRC-03"], "carry_forward_steps": [5]},
 "notes": "forgot to multiply the -9 by 2"}
```

- `images`: photo paths relative to the file. The whole pipeline runs (reading the
  handwriting, then grading). Or give `lines` instead: the work typed out as LaTeX,
  one string per line, which tests the grading only.
- `root_codes`: the codes a tutor would give (the 16 in `docs/TEAM.md`). `[]` for
  fully correct work; include some of those.
- `carry_forward_steps`: written-line numbers (counting from 1) that are wrong only
  because of an earlier mistake.
- **No names.** Cover or crop names before taking the photo. Gold photos are not
  committed to the repo: keep them in the project's shared files and copy them in to run.

Labelling in a spreadsheet is fine: columns `id, photo file, course, unit/topic, error
codes, carry-forward line numbers, notes`. Claude converts it.

`gold/synthetic.jsonl` holds 22 typed samples written by Claude (15 of the 16 codes,
three fully correct, 18 carry-forward lines). They let prompt tuning start before the
photo set exists, but their labels have not been reviewed by a tutor.
