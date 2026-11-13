# BirdBrains backend

Python API and AI pipeline for BirdBrains. It follows the AI pipeline spec and
serves the JSON contracts in `../types/birdBrains.ts`.

```
birdbrains/
  schemas.py                 Pydantic v2 contracts (pipeline: strict snake_case; API: camelCase)
  taxonomy.py                Four-Pillar error codes + Ontario curriculum registry (the cached context)
  pipeline.py                Stage 1 (gemini-2.5-flash) and Stage 2 (gemini-2.5-pro, thinking 2048), 24h context cache, MLflow traces
  mastery_affect_ledger.py   Dual EWMA (mastery 0.30, valence 0.35) + scaffolding-mode state machine
  batch_engine.py            Nightly worksheet generation through the Vertex AI Batch API
  projections.py             Stored records -> grading, worksheet and parent-summary payloads
  api.py                     FastAPI routes, upload checks, access control
  store.py / storage.py      Firestore + Cloud Storage, with in-memory / local-disk twins
  auth.py                    Firebase ID-token verification (dev tokens for local use only)
  fake.py                    Deterministic stand-in for Gemini (local runs and tests)
```

## Run it locally (no cloud account needed)

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest

BIRDBRAINS_BACKEND=local BIRDBRAINS_MODEL=fake BIRDBRAINS_AUTH=dev BIRDBRAINS_BATCH_TOKEN=dev \
  uvicorn birdbrains.api:create_app --factory --port 8080
```

In this mode data lives in memory, photos in `.birdbrains-data/`, every upload gets
the spec's completing-the-square diagnostic, and the caller is whoever
`Authorization: Bearer dev:<any-id>` says. Point the frontend at it with
`NEXT_PUBLIC_API_URL=http://localhost:8080` in `../.env.local`.

To exercise real Gemini from your machine, keep `BIRDBRAINS_BACKEND=local`, set
`BIRDBRAINS_MODEL=gemini` and `GOOGLE_CLOUD_PROJECT`, and run
`gcloud auth application-default login`.

## Deploy

1. `./deploy.sh <gcp-project-id>` creates the Montréal bucket, Firestore database,
   service account, Cloud Run service and the two Cloud Scheduler jobs, and prints the API URL.
2. Firebase sign-in (console, one time): open https://console.firebase.google.com,
   "Add project" and pick the same Google Cloud project, then Authentication >
   Sign-in method > enable Email/Password, and Authentication > Settings >
   Authorized domains > add `birdbrains.netlify.app`. Under Project settings >
   Your apps, add a Web app and copy its config.
3. In Netlify (Site configuration > Environment variables) set
   `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`,
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, then redeploy the site.

## Routes

| Route | Who | What |
|---|---|---|
| `POST /me` | signed-in | Create profile (`student` gets a `stu_` id and a link code; `parent`) |
| `POST /me/children` | parent | Link to a student with their link code |
| `POST /submissions` | student, linked parent | Multipart photo upload. Re-checks type, size, 1080p and sharpness. Returns `SubmissionIngestionPayload` |
| `POST /submissions/{id}/process` | same | Runs Stage 1 + Stage 2, updates the ledger, returns the grading. Idempotent |
| `GET /students/{id}/gradings/latest`, `GET /gradings/{id}` | same | `Stage2GradingAndAffectOutput` (frontend shape) |
| `GET /gradings/{id}/worksheet` | same | `WS_3STAGE_V1`, or 404 `WORKSHEET_QUEUED` until the nightly batch has run |
| `GET /students/{id}/parent-summary` | same | `ParentProjectionSummary` |
| `POST /internal/batch/worksheets/{submit,collect}` | Cloud Scheduler (`X-Batch-Token`) | Nightly worksheet batch |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BIRDBRAINS_BACKEND` | `gcp` | `gcp` (Firestore + Cloud Storage) or `local` |
| `BIRDBRAINS_MODEL` | `gemini` | `gemini` or `fake` |
| `BIRDBRAINS_AUTH` | `firebase` | `firebase` or `dev`. `dev`/`local` are refused on Cloud Run |
| `GOOGLE_CLOUD_PROJECT`, `BIRDBRAINS_BUCKET` | | Required with `gcp` |
| `BIRDBRAINS_CORS_ORIGINS` | Netlify site + localhost:3000 | Comma-separated origins allowed to call the API |
| `BIRDBRAINS_BATCH_TOKEN` | unset (batch routes off) | Shared secret for the scheduler |
| `BIRDBRAINS_STAGE1_MODEL`, `BIRDBRAINS_STAGE2_MODEL`, `BIRDBRAINS_WORKSHEET_MODEL` | spec models | Override when Google retires a model |
| `MLFLOW_TRACKING_URI` | unset (tracing off) | Where `@mlflow.trace` spans go |

The Vertex AI location is fixed to `northamerica-northeast1` in code.

## Choices the specs left open

These are defaults picked during the build; each is one constant or one file.

- **Error codes** (`taxonomy.py`): the spec defines the code format, not the list. The registry there is a draft.
- **Speed-bump rule** (`mastery_affect_ledger.py`): the spec gives only the de-escalation threshold (valence <= -0.45). `METACOGNITIVE_SPEED_BUMP` triggers when, over the last 3 submissions, there is at least one root error per submission and half or more are FAC/TST slips.
- **Scores**: Stage 2 returns per-pillar scores out of CON 3, PRC 3, FAC 2, TST 2, plus the student message, a parent insight and an error severity. These fields extend the spec's Stage 2 schema because the dashboards need them.
- **EQAO forecast** (`projections.py`): level from the observation-weighted mean mastery against Ontario's 60/70/80 bands. The confidence figure is a heuristic, not a statistical interval.
- **Low-confidence OCR**: below 0.60 overall confidence, Stage 2 is skipped and the student is asked to retake the photo.

## Not verified yet

Everything is tested against a stubbed Gemini client. Calls to real Vertex AI
(structured output with these schemas, context-cache minimum size, the batch
JSONL format) and `deploy.sh` have not been run against a real project.
