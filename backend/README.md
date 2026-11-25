# BirdBrains backend

Python API and AI pipeline for BirdBrains. It follows the AI pipeline spec and
serves the JSON contracts in `../types/birdBrains.ts`.

```
birdbrains/
  schemas.py                 Pydantic v2 contracts (pipeline: strict snake_case; API: camelCase)
  taxonomy.py                the 16 official error codes + Ontario curriculum registry (the cached context)
  pipeline.py                Stage 1 and Stage 2 (gemini-3.5-flash, thinking levels), 24h context cache, MLflow traces
  mastery_affect_ledger.py   Dual EWMA (mastery 0.30, valence 0.35) + scaffolding-mode state machine
  batch_engine.py            Nightly worksheet generation through the Vertex AI Batch API
  projections.py             Stored records -> grading, worksheet and parent-summary payloads
  api.py                     FastAPI routes, upload checks, access control, classes, delete-my-data
  privacy.py                 Photo scrubbing before storage: EXIF removed, name/date/class fields found with Gemini in Montréal (or Cloud DLP, BIRDBRAINS_PRIVACY_DETECTOR=dlp) and blurred
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
   Authorized domains > check `<project>.web.app` is listed (add any custom domain). Under
   Project settings > Your apps, add a Web app (no need to copy its config).
3. From the repo root, `./deploy-web.sh <gcp-project-id>` reads the API URL and the Firebase web
   config, builds the site with them, and publishes it to Firebase Hosting at
   `https://<project>.web.app`. Rerun it to publish a new version of the site.

## Routes

| Route | Who | What |
|---|---|---|
| `POST /me` | signed-in | Create profile (`student` gets a `stu_` id and a link code; `parent`) |
| `POST /me/children` | parent | Link to a student with their link code |
| `POST /submissions` | student, linked parent | Multipart photo upload. Re-checks type, size, 1080p and sharpness; 409 if the same photo was already uploaded for this student. Returns `SubmissionIngestionPayload` |
| `POST /submissions/{id}/process` | same | Runs Stage 1 + Stage 2, updates the ledger, returns the grading. Idempotent |
| `GET /students/{id}/gradings/latest`, `GET /gradings/{id}` | same | `Stage2GradingAndAffectOutput` (frontend shape) |
| `GET /gradings/{id}/worksheet` | same | `WS_3STAGE_V1`, or 404 `WORKSHEET_QUEUED` until the nightly batch has run |
| `GET /students/{id}/parent-summary` | same | `ParentProjectionSummary` |
| `PATCH /me`, `DELETE /me` | signed-in | Change name; delete the account (a student's account takes all their data with it) |
| `GET/POST /me/classes`, `DELETE /me/classes/{id}` | student | List, join with a class code, leave |
| `POST /uploads`, `PUT /uploads/{id}/file?token=` | owner; link holder | One-time 15-minute upload link for the Chrome extension, then the raw photo |
| `POST/GET/DELETE /phone-uploads[/{id}]` | owner | Phone camera link for a QR code (15 minutes, one upload; `kind` new or addPhotos), watched by the computer that made it. See docs/PHONE_UPLOAD.md |
| `GET /phone/{id}`, `POST /phone/{id}/photos` | link holder (`X-Upload-Token`) | The phone reads what the link is for, then sends photos; they are read and graded in that request |
| `GET /gradings/{id}/worksheet.pdf` | owner | Worksheet PDF (WeasyPrint, template in `worksheet_pdf.py`) |
| `GET /students/{id}/usage` | owner | Plan and uploads left this month (Free: 402 `FREE_LIMIT_REACHED` when 0) |
| `GET /billing/price` | public | Pro price for the Plans page (`configured: false` when Stripe is off) |
| `POST /billing/checkout`, `/billing/portal`, `/billing/webhook` | signed-in; Stripe | Stripe Checkout and portal links; the signed webhook sets the plan (`billing.py`) |
| `/classroom/*`, `GET /teacher/students` | Pro teacher | Google Classroom connect, courses, assignments, import handed-in photos (`classroom.py`) |
| `GET /students/{id}/progress` | owner | Results over time: mastery per strand, timeline, recurring error codes (`reports.py`) |
| `GET /teacher/report` | Pro teacher | Class overview across imported students |
| `GET /internal/stats?days=1` | `X-Batch-Token` | Counts for the daily pilot summary (no names or ids) |
| `POST /internal/users/{uid}/plan` | `X-Batch-Token` | Set `free` / `pro` until billing exists |
| `POST /internal/testers` | `X-Batch-Token` | Turn a testing account on/off by `email` or `uid` (see below) |
| `DELETE /students/{id}` | student, linked parent | Delete every record and photo for that student |
| `POST /internal/schools`, `POST /internal/schools/{id}/classes` | `X-Batch-Token` | Create a school (and tenant) and a class with a join code |
| `POST /internal/batch/worksheets/{submit,collect}` | Cloud Scheduler (`X-Batch-Token`) | Nightly worksheet batch |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BIRDBRAINS_BACKEND` | `gcp` | `gcp` (Firestore + Cloud Storage) or `local` |
| `BIRDBRAINS_MODEL` | `gemini` | `gemini` or `fake` |
| `BIRDBRAINS_PRIVACY_DETECTOR` | `gemini` | what finds names and dates on photos before storage: `gemini` (Montréal) or `dlp` (Cloud DLP; its image inspection is not offered in Montréal) |
| `BIRDBRAINS_AUTH` | `firebase` | `firebase` or `dev`. `dev`/`local` are refused on Cloud Run |
| `GOOGLE_CLOUD_PROJECT`, `BIRDBRAINS_BUCKET` | | Required with `gcp` |
| `BIRDBRAINS_CORS_ORIGINS` | Firebase Hosting site (+ old Netlify address) + localhost:3000 | Comma-separated origins allowed to call the API |
| `BIRDBRAINS_BATCH_TOKEN` | unset (batch routes off) | Shared secret for the scheduler |
| `BIRDBRAINS_STAGE1_MODEL`, `BIRDBRAINS_STAGE2_MODEL`, `BIRDBRAINS_WORKSHEET_MODEL` | spec models | Override when Google retires a model |
| `BIRDBRAINS_HEADER_MASK` | `0` | Optional backstop: share of the page, from the top, blacked out before storage. Detected name/date/class fields are blurred regardless |
| `BIRDBRAINS_FREE_MONTHLY_SUBMISSIONS` | `10` | Uploads per student per calendar month on the Free plan |
| `BIRDBRAINS_FREE_WORKSHEETS` | `0` | `1` gives Free gradings nightly worksheets too |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | unset (upgrades off) | Stripe key, webhook signing secret and the Pro price id. `deploy.sh` reads them from Secret Manager (`tools/stripe_setup.py` writes them) |
| `STRIPE_PORTAL_CONFIGURATION` | unset (account default) | Customer portal settings id (`bpc_...`) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `BIRDBRAINS_PUBLIC_URL` | unset (Classroom off) | Google OAuth web client and the API's own URL (for the redirect) |
| `BIRDBRAINS_SITE_URL` | Firebase Hosting site | Where Stripe and Google send people back to |
| `MLFLOW_TRACKING_URI` | unset (tracing off) | Where `@mlflow.trace` spans go |
| `BIRDBRAINS_CLASSROOM` | unset | `demo` swaps in a pretend Google Classroom (3 classes, invented students) for testing. Refused on Cloud Run. See `docs/TEST_CLASSROOMS.md` |

The Vertex AI location defaults to `northamerica-northeast1` (Canada, PIPEDA). `BIRDBRAINS_VERTEX_LOCATION` overrides it, but only change it after deciding that photos may be processed outside Canada.
If uploads end in "The diagnostic could not be completed", run `python tools/check_models.py --project <project>` in Cloud Shell to see which regions serve the models, and search the Cloud Run logs for `pipeline_failed` (it holds Google's error text, never student work).

## Choices the specs left open

These are defaults picked during the build; each is one constant or one file.

- **Error codes** (`taxonomy.py`): the spec defines the code format, not the list. The registry there is a draft.
- **Speed-bump rule** (`mastery_affect_ledger.py`): the spec gives only the de-escalation threshold (valence <= -0.45). `METACOGNITIVE_SPEED_BUMP` triggers when, over the last 3 submissions, there is at least one root error per submission and half or more are FAC/TST slips.
- **Scores**: Stage 2 returns per-pillar scores out of CON 3, PRC 3, FAC 2, TST 2, plus the student message, a parent insight and an error severity. These fields extend the spec's Stage 2 schema because the dashboards need them.
- **EQAO forecast** (`projections.py`): level from the observation-weighted mean mastery against Ontario's 60/70/80 bands. The confidence figure is a heuristic, not a statistical interval.
- **Low-confidence OCR**: below 0.60 overall confidence, Stage 2 is skipped and the student is asked to retake the photo.

## Free and Pro pipelines

| | Free | Pro |
|---|---|---|
| Stage 1 (read the handwriting; also detects course, unit, topic) | `gemini-3.5-flash`, minimal thinking | `gemini-3.5-flash`, minimal thinking |
| Stage 2 (grade) | `gemini-3.5-flash`, minimal thinking, no mood analysis | `gemini-3.5-flash`, low thinking, mood analysis |
| Context cache | its own 24 h cache | its own 24 h cache |

The plan is decided per upload from the student's effective plan. On Free the model is
told to skip mood analysis and anything it returns for mood is discarded. Models are
set with `BIRDBRAINS_STAGE1_MODEL`, `BIRDBRAINS_STAGE2_MODEL`, `BIRDBRAINS_STAGE2_FREE_MODEL`
and the thinking levels (MINIMAL, LOW, MEDIUM, HIGH) with `BIRDBRAINS_STAGE1_THINKING`, `BIRDBRAINS_STAGE2_THINKING`
and `BIRDBRAINS_STAGE2_FREE_THINKING`. Gemini 2.5 was retired on Vertex AI on 2026-10-20; `gemini-3.5-flash` is
the model that answers in Montréal (Toronto serves none). First real run (2026-11-18): about 7-10 s for stage 1,
17-28 s for a whole upload, roughly $0.05-0.08 each.

Every graded upload stores its token counts, time and estimated cost on the grading
record (`cost`, never returned by the API) and prints one `pipeline_done` JSON line.
Prices per million tokens are in `pipeline.DEFAULT_PRICES`; override with
`BIRDBRAINS_PRICES_JSON` (`{"model": [input, cached input, output]}`) when Google changes them.

## Testing accounts

A testing account has no monthly upload cap, can send the same photo again to have it
graded again (no 409 / code 108), and has every Pro feature. The flag covers the
student, and any student linked to a tester parent or teacher. Only the admin route
`POST /internal/testers` sets it (it needs the batch token), so nobody can give it
to themselves. Tester uploads are left out of `GET /internal/stats` and shown as
`testerUploads` instead.

1. Sign up on the site with the test email (student, or parent + linked student).
2. In Cloud Shell, from `~/birdbrains/backend`:

```bash
pip install -q httpx
python tools/set_tester.py \
  --url https://birdbrains-api-28737473918.northamerica-northeast1.run.app \
  --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)" \
  --email you@example.com          # --off to undo
```

## Accuracy, load and monitoring tools

- `python -m ai_eval ...`: accuracy harness and gold-set format, see [`ai_eval/README.md`](ai_eval/README.md).
- `python tools/smoke_test.py --url ... --firebase-key ... --batch-token ...`: the week 1 exit check and the Free vs Pro test as a script (25 checks, makes and deletes its own accounts; `--dev` for a local server).
- `python tools/pilot_summary.py --url ... --batch-token ...`: daily pilot summary from `GET /internal/stats`.
- `python tools/load_test.py --url ... --token ... --student-id ...`: 30 uploads at once (E2E-02).
- `./monitoring.sh <project> <email>`: uptime check, cost and speed metrics by plan, four alerts, a dashboard.
- `birdbrains/math_lint.py`: generated worksheets with unbalanced brackets, broken LaTeX or
  a wrong blank structure are rejected and retried the next night.
- Launch checklist and runbook: [`docs/LAUNCH.md`](../docs/LAUNCH.md).

## Not verified yet

Everything is tested against a stubbed Gemini client. Calls to real Vertex AI
(structured output with these schemas, context-cache minimum size, the batch
JSONL format, real token costs and speed), the Firestore transaction behind the Free cap counter (`usagecounters`), `deploy.sh` since Nov 13 and
`monitoring.sh` have not been run against the real project.

## Turning on Stripe and Google Classroom

Both stay off until their secrets exist; `deploy.sh` picks them up on the next run.
Create each secret in Cloud Shell (values never go in chat or in git):

```bash
mk() { printf '%s' "$2" | gcloud secrets create "$1" --data-file=- \
  --replication-policy=user-managed --locations=northamerica-northeast1; }
```

**Stripe** (sandbox first, then live). One script does the whole Stripe side:

```bash
cd backend && python tools/stripe_setup.py --project birdbrain-514606 --price 12.99
./deploy.sh birdbrain-514606
```

It asks for the secret key without echoing it (Stripe dashboard > Developers > API keys),
creates or reuses product "BirdBrains Pro" with a monthly CAD price (lookup key
`birdbrains_pro_monthly`), creates customer portal settings (card, invoices, cancel at period
end), points a webhook at `<API URL>/billing/webhook`, and stores four secrets:
`birdbrains-stripe-secret-key`, `-webhook-secret`, `-price-id`, `-portal-config`.
Run it again with the `sk_live_` key before launch, then redeploy. Changing `--price` makes a
new price; existing subscribers keep theirs.

How it behaves:
- The signed webhook is the only thing that sets `plan`. Events are applied newest-first by
  their `created` time (`stripeEventAt`), so a late, older event never undoes a newer one.
- `past_due` keeps Pro while Stripe retries the card; `unpaid`, `canceled` or deletion makes it Free.
- A student already covered by a Pro parent gets 409 `COVERED_BY_PARENT` instead of a second subscription.
- Deleting an account (`DELETE /me`, or a student's data) cancels its Stripe subscriptions at once.
- `GET /billing/price` (public) gives the Plans page the price; it is cached for an hour.
- Calls pin `Stripe-Version` (`STRIPE_API_VERSION` in `billing.py`) and send an `Idempotency-Key`.
- No sales tax is charged (sole proprietor under the $30,000 small-supplier threshold). Once over it,
  register for GST/HST and turn on Stripe Tax (`automatic_tax[enabled]=true` in `checkout_url`).

Test card in the sandbox: `4242 4242 4242 4242`, any future date, any CVC.

**Google Classroom**
1. Cloud console (project `birdbrain-514606`) > APIs & Services > OAuth consent screen: External,
   app name BirdBrains, add the five scopes in `SCOPES` and `STUDENT_SCOPES` in `birdbrains/classroom.py`,
   and add your test accounts under Test users.
2. Credentials > Create credentials > OAuth client ID > Web application. Authorized redirect URI:
   `<API URL>/classroom/callback`. Copy the client id and secret.
3. `mk birdbrains-google-oauth-client-id ...`, `mk birdbrains-google-oauth-client-secret ...`, rerun `deploy.sh`.

While the consent screen is in "Testing", only the listed test users can connect (up to 100) and
their connection expires after 7 days. Going public needs Google's verification; `drive.readonly`
is a restricted scope, which also needs a yearly third-party security assessment.

**Beta sign-up.** Classroom is a "sign up to test" beta for Pro teachers and Pro students (Google's
100 Test users are shared by both). They enter the Google email they use for Classroom (Teacher Hub,
or the student dashboard); that makes a pending request. Add that email under
Test users on the consent screen, then approve it with `python tools/classroom_beta.py --approve
<email>` (lists pending requests with no flags; the daily stats show `classroomBetaPending`).
Connect only works once approved. Testing accounts skip the list.

**Students** connect with only `classroom.courses.readonly` and `classroom.coursework.me.readonly`
(their classes, assignments, their own grades, the teacher's instructions and rubric). Each
assignment gets an upload; the teacher's instructions and rubric (never the grade) go into
grading (`SubmissionContext.teacher_expectations`). Rubrics are read when Google allows it. The cap is
`BIRDBRAINS_CLASSROOM_BETA_LIMIT` (default 100, Google's Test user limit).

Grades are not sent back to Classroom: Google lets an app set grades only on assignments
that app created, and teachers make assignments in Classroom. Teachers copy scores across.

## Photo quality

- **Straightening** (`birdbrains/photo_prep.py`): every uploaded photo is flattened to a straight top-down page, cropped to the paper and evened out for lighting before it is scrubbed and stored. If no clear page outline is found (for example a close-up of one question), the photo is stored unchanged.
- **Known worksheets** (`birdbrains/known_worksheets.py`): when the reading step sees a printed code such as `BB-W12`, the question text comes from this file instead of the photo. Add a sheet by adding its code and its numbered questions, word for word.
- **Adding photos to an upload**: `POST /submissions/{id}/photos` (form field `files`) adds photos of the same page, such as a clearer re-shoot or close-ups of single questions. The same photo may be sent again. The page is read again from all of its photos and the grading is replaced. It does not use a monthly upload and the ledger is not counted twice. Limits: 10 photos per upload, 3 rounds of adding.
