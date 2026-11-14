# BirdBrains team handoff

Who owns what, how we branch and review, the API the UI is built against, and
how to run everything on your own machine with no cloud account. Launch is
**Mon Dec 14, 2026**. The day-by-day plan is in TickTick (list 🐦BirdBrains)
and in `BirdBrains Plan.md`; task titles start with the owner.

## 1. People and folders

| Owner | Owns | Does not touch |
|---|---|---|
| **Gemini** (UI, via Jules or Gemini CLI) | `app/`, `components/`, `extension/` (Chrome extension), page styles, `public/` | `backend/`, `lib/api.ts`, `types/birdBrains.ts` |
| **Claude** (API, infrastructure, privacy) | `backend/` except the AI pipeline files below, `backend/deploy.sh`, `lib/api.ts`, `lib/session.tsx`, `types/birdBrains.ts`, `docs/TEAM.md` | UI layout and visual design |
| **Freelancer** (AI pipeline) | `backend/birdbrains/pipeline.py`, `taxonomy.py`, `batch_engine.py`, `backend/eval/` (accuracy harness, gold set) | API routes, storage, auth |
| **Maalik** | Product decisions, merging every PR, GCP/Netlify/Firebase consoles, test photos and grading reviews | |

Until the freelancer is confirmed (decision due **Tue Nov 17**), Claude covers
the pipeline files too.

Shared files, changed only with the owner's review:
- `types/birdBrains.ts` is the contract between UI and API. Gemini may ask for
  a field; Claude adds it to the API and the type in the same PR.
- `mocks/birdBrainsMockData.json` (demo data) must always match `types/birdBrains.ts`.
  Anyone may add mock entries; keep them valid against the types.
- `lib/errorCodes.ts` mirrors `ERROR_CODES` in `backend/birdbrains/taxonomy.py`.
- `lib/pillars.ts`, `lib/projections.ts`, `lib/imageQuality.ts`: UI helpers, Gemini
  may edit; tell Claude if `imageQuality.ts` thresholds change (the server checks the same limits).

## 2. Branches, PRs and reviews

- `main` is what ships. Nobody pushes to it directly; **Maalik merges every PR**.
- **Gemini pushes only to `gemini/*` branches** (e.g. `gemini/upload-states`).
  Claude uses `claude/*`, the freelancer `luca/*`.
- One task per PR, titled like the TickTick task. Say in the description which
  task it closes and paste a screenshot for UI changes.
- Before asking for a merge: `npm run build` passes (static export), and for
  backend changes `cd backend && pytest` passes.
- **Claude reviews every Gemini PR** against this contract: calls go through
  `lib/api.ts`, response fields match `types/birdBrains.ts`, demo mode still works
  with no `NEXT_PUBLIC_API_URL`, nothing outside the owner's folders changed.
- If a PR needs a new endpoint or field, open it anyway with the UI against mock
  data and say what is missing; Claude adds the API side.
- Never commit secrets, `.env.local`, student photos or real student names.

## 3. How the frontend talks to the API

- Every call goes through `api` in `lib/api.ts`. Do not call `fetch` to the API
  from components. If you need a new call, ask Claude (or add it to `lib/api.ts`
  in your PR and Claude will check it).
- The session (`useSession()` in `lib/session.tsx`) gives you the signed-in
  profile, the Firebase ID token and `demo`. In **demo mode** (no API URL, or the
  "Try the demo" card) pages read `mocks/birdBrainsMockData.json`; every new
  screen needs a demo state.
- Errors arrive as `ApiError { status, detail }`. `detail` is a sentence you can
  show to the user, except the codes listed under each route below.
- Live API: `https://birdbrains-api-28737473918.northamerica-northeast1.run.app`
  (Cloud Run, Montréal). Live site: https://birdbrains.netlify.app.

## 4. API contract

Auth: every route except `/health` needs `Authorization: Bearer <Firebase ID token>`.
JSON is camelCase. Ids: `stu_` + 12 characters (student), `sub_` (submission),
`grd_` (grading), `wks_` (worksheet). Students and parents only ever see their
own or their linked children's data; anything else is a 404.

| Method and path | Who | Returns | Notable errors |
|---|---|---|---|
| `GET /health` | anyone | `{"ok": true}` | |
| `GET /me` | signed in | `UserProfile` | 401 not signed in, 403 `PROFILE_REQUIRED` (show the "who are you" step) |
| `POST /me` `{role, name, course?}` | signed in | `UserProfile` (students get a `studentId` and a `linkCode`) | 422 student without course. Role cannot change later |
| `PATCH /me` `{name}` | signed in | `UserProfile` | |
| `DELETE /me` | signed in | 204. A student's account goes with all their data; a parent's account only | Ask for confirmation first; sign the user out after |
| `POST /me/children` `{linkCode}` | parent | `UserProfile` with `childStudentIds` | 404 unknown code, 403 not a parent |
| `GET /me/classes` | student | `ApiClass[]` | |
| `POST /me/classes` `{joinCode}` | student | `ApiClass[]` after joining (codes are 6 characters, any case) | 404 unknown code, 403 not a student |
| `DELETE /me/classes/{classId}` | student | `ApiClass[]` after leaving | |
| `DELETE /students/{id}` | the student, or a linked parent | 204. Deletes every photo, diagnostic, worksheet and the student's account | 404 |
| `POST /submissions` multipart | student, linked parent | `SubmissionIngestionPayload`, 201 | 422 bad file, below 1080p or too blurry; 413 over 12 MB; **409 same photo already uploaded** (`Location` header = the earlier submission); 503 privacy check failed, try again |
| `GET /submissions/{id}` | owner | `SubmissionIngestionPayload` | 404 |
| `GET /submissions/{id}/files/{i}` | owner | the image, with names blacked out | 404; 410 `PHOTO_EXPIRED` (photos are deleted after 90 days) |
| `POST /submissions/{id}/process` | owner | `{submission, grading}`; `grading` is null when `status` is `NEEDS_RETAKE` | 502 pipeline failed (show "try again") |
| `GET /students/{id}/gradings` | owner | `Stage2GradingAndAffectOutput[]`, newest first, max 50 | |
| `GET /students/{id}/gradings/latest` | owner | `Stage2GradingAndAffectOutput` | 404 `NO_GRADED_WORK` (empty state) |
| `GET /gradings/{id}` | owner | `Stage2GradingAndAffectOutput` | 404 |
| `GET /gradings/{id}/worksheet` | owner | `WS_3STAGE_V1` | 404 `WORKSHEET_QUEUED` / `WORKSHEET_PENDING` (made overnight), `WORKSHEET_NOT_NEEDED` (no errors), `WORKSHEET_FAILED` |
| `GET /students/{id}/parent-summary` | linked parent (or the student) | `ParentProjectionSummary` | 404 `NO_GRADED_WORK` |
| `POST /internal/batch/worksheets/{submit,collect}` | Cloud Scheduler only | | not for the UI |
| `POST /internal/schools`, `POST /internal/schools/{id}/classes` | admin token only | school, class with `joinCode` | not for the UI; teachers get this on Nov 23 |

Upload form fields for `POST /submissions`: `studentId`, `course` (`MTH1W` or
`MPM2D`), `unitTopic` (1 to 200 characters), `sharpnessScore` (0 to 100, from
`lib/imageQuality.ts`), and 1 to 6 `files` (JPEG, PNG or WebP). Submission
`status` goes `UPLOADED → TRANSCRIBING → GRADING → GRADED`, or ends in
`NEEDS_RETAKE` or `FAILED`.

`UserProfile` now also has `tenantId` and `classIds`. `ApiClass` is
`{classId, className, gradeLevel (3 to 12), schoolId, schoolName}`.

**Privacy, for UI copy:** before a photo is stored, the top 12% of the page is
blacked out (where names usually go), names, emails and phone numbers found
anywhere else are blacked out, and location data is removed. Tell students to
write their name at the top or not at all. Photos are deleted after 90 days;
diagnostics stay until the family deletes them.

### Shared vocabulary

- Pillars: `CON` Conceptual, `PRC` Procedural, `FAC` Factual & Calculation, `TST` Test-Taking & Communication.
- Error codes: 16 official codes `CON-01`…`TST-04`; names in `lib/errorCodes.ts`.
  They appear as `entityExtractions[].misconceptionId`.
- Affect states: `CONFIDENT_MASTERY`, `PRODUCTIVE_STRUGGLE`, `HIGH_FRICTION_FRUSTRATION`,
  `COGNITIVE_OVERLOAD_AVOIDANCE`, `RUSHED_CARELESSNESS`.
- Scaffolding modes: `HIGH_SUPPORT_DEESCALATION`, `METACOGNITIVE_SPEED_BUMP`, `STANDARD_PROGRESSIVE_FADE`.
- Severity: `LOW`, `MEDIUM`, `HIGH`. EQAO forecast: `LEVEL_1` to `LEVEL_4`.

### Example responses

These are real responses from the local backend with the fake model (section 5).

`POST /me` (student):

```json
{
  "uid": "alex", "role": "student", "name": "Alex Mercer",
  "studentId": "stu_zvd02PynvXEK", "course": "MPM2D",
  "linkCode": "DBLE7QA2", "childStudentIds": []
}
```

`POST /submissions` (201):

```json
{
  "submissionId": "sub_1RsTqeFoHYAV", "studentId": "stu_zvd02PynvXEK",
  "course": "MPM2D", "unitTopic": "Completing the Square · vertex form",
  "imageResolution": {"width": 1600, "height": 1200},
  "sharpnessScore": 82.0, "isQualityPassed": true,
  "uploadedAt": "2026-11-13T23:18:34.692011+00:00",
  "fileUrls": ["/submissions/sub_1RsTqeFoHYAV/files/0"],
  "status": "UPLOADED", "gradingId": null
}
```

`POST /submissions/{id}/process` → `grading` (the `submission` part is as above with `status: "GRADED"`):

```json
{
  "gradingId": "grd_XvY7RkzPMfpl",
  "submissionId": "sub_1RsTqeFoHYAV",
  "studentId": "stu_zvd02PynvXEK",
  "topic": "Completing the Square · vertex form",
  "totalScore": 8.0,
  "maxPossibleScore": 10.0,
  "affectState": "HIGH_FRICTION_FRUSTRATION",
  "supportiveFramingMessage": "Great persistence! You set up the square correctly ...",
  "pillarBreakdowns": [
    {"pillar": "CON", "maxScore": 3.0, "earnedScore": 3.0, "errorCount": 0, "feedback": "You clearly understand how vertex form is built."},
    {"pillar": "PRC", "maxScore": 3.0, "earnedScore": 1.5, "errorCount": 1, "feedback": "One slip when taking -9 out of the bracket in step 4."},
    {"pillar": "FAC", "maxScore": 2.0, "earnedScore": 2.0, "errorCount": 0, "feedback": "Your arithmetic was accurate throughout."},
    {"pillar": "TST", "maxScore": 2.0, "earnedScore": 1.5, "errorCount": 0, "feedback": "State the vertex as a point at the end."}
  ],
  "stepDiagnostics": [
    {"stepNumber": 4, "studentInput": "y = 2(x + 3)^2 - 9 + 5", "isCorrect": false, "pillarImpacted": "PRC",
     "isCarryForwardProtected": false, "explanation": "The -9 leaving the bracket was not multiplied by the outer factor of 2. It should be -18."},
    {"stepNumber": 5, "studentInput": "y = 2(x + 3)^2 - 4", "isCorrect": true, "pillarImpacted": "PRC",
     "isCarryForwardProtected": true, "explanation": "Carry-forward protection: -9 + 5 = -4 is consistent with step 4, so no marks are lost here."}
  ],
  "entityExtractions": [
    {"misconceptionId": "PRC-03", "description": "Did not distribute the leading coefficient to the term removed from the bracket.", "severity": "HIGH"}
  ],
  "scaffoldingMode": "STANDARD_PROGRESSIVE_FADE",
  "gradedAt": "2026-11-13T23:18:34.695545+00:00"
}
```

(Steps 1 to 3 trimmed. `studentInput` may contain LaTeX.)

`GET /gradings/{id}/worksheet`:

```json
{
  "worksheetId": "wks_dYQUKixf9bkT",
  "gradingId": "grd_XvY7RkzPMfpl",
  "title": "Mastering Leading Coefficients in Completing the Square",
  "targetConcept": "Distributing the outer factor when a term leaves the bracket.",
  "sectionA_DiagnosticMirror": [
    {"originalStepText": "y = 2(x + 3)^2 - 9 + 5",
     "annotatedCorrection": "y = 2(x + 3)^2 - (2 * 9) + 5  =>  y = 2(x + 3)^2 - 18 + 5",
     "keyTakeaway": "Any number leaving the bracket must be multiplied by the factor outside."}
  ],
  "sectionB_FadedScaffolding": [
    {"stepNumber": 1, "prompt": "Convert y = 3x^2 + 12x + 1 to vertex form.", "scaffoldingType": "GIVEN",
     "givenContent": "Group and factor out 3: y = 3(x^2 + 4x) + 1", "blankPlaceholder": null,
     "hint": "Check the factoring by redistributing in your head."},
    {"stepNumber": 2, "prompt": "Complete the square inside the bracket.", "scaffoldingType": "PARTIAL_BLANK",
     "givenContent": "y = 3(x^2 + 4x + [ __ ] - [ __ ]) + 1", "blankPlaceholder": "4", "hint": "Half of 4 is 2. Square it."}
  ],
  "sectionC_IndependentTransfer": {
    "problemId": "tp_dYQUKixf9bkT",
    "problemStatement": "Convert y = -4x^2 + 24x - 7 into vertex form and state the maximum point.",
    "targetPillarFocus": "PRC",
    "metacognitiveChecklist": ["I factored out -4 correctly in the first step.", "I multiplied the value removed from the bracket by -4."]
  }
}
```

`scaffoldingType` is `GIVEN`, `PARTIAL_BLANK` or `INDEPENDENT`; `[ __ ]` marks an answer box.

`GET /students/{id}/parent-summary`:

```json
{
  "studentId": "stu_zvd02PynvXEK",
  "studentName": "Alex Mercer",
  "course": "MPM2D",
  "overallEqaoForecast": "LEVEL_4",
  "eqaoForecastConfidence": 53.0,
  "strandMasteries": [
    {"strandName": "Quadratic Relations", "currentEWMAMastery": 0.8,
     "historicalTrajectory": [{"weekLabel": "Wk 1", "score": 80.0}]}
  ],
  "pillarErrorDistribution": [{"pillar": "PRC", "percentageOfTotalErrors": 100.0}],
  "cognitiveFrictionAlerts": [
    {"detectedDate": "2026-11-13", "frictionLevel": "HIGH_FRICTION_FRUSTRATION",
     "topicContext": "Completing the Square · vertex form",
     "actionableParentInsight": "The ideas are understood; the frustration comes from one repeated multiplication slip. ..."}
  ]
}
```

### Coming next (Claude adds them here before the UI task that needs them)

| Due | Endpoints | For Gemini's task |
|---|---|---|
| ~~Wed Nov 18~~ done | Profile, classes and join codes, delete my data (in the table above) | Account and settings screens (Thu Nov 19) |
| Mon Nov 23 | Teacher role; review queue: list, approve, fix grade, request rescan | Teacher review queue screens (Wed Nov 25) |
| Fri Nov 27 | Signed-URL upload + status for the Chrome extension | Chrome extension (Mon Nov 30) |
| Mon Dec 7 | Worksheet PDF download links | PDF buttons (Tue Dec 8) |
| Wed Dec 30 | Reports (class overview, progress over time) | Report screens |

Build those screens against mock data first if the API is not there yet.

## 5. Run it locally (no cloud account)

Backend with the fake model, in-memory data and dev sign-in:

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest
BIRDBRAINS_BACKEND=local BIRDBRAINS_MODEL=fake BIRDBRAINS_AUTH=dev BIRDBRAINS_BATCH_TOKEN=dev \
  uvicorn birdbrains.api:create_app --factory --port 8080
```

Every upload gets the completing-the-square diagnostic above. Requests sign in
as whoever `Authorization: Bearer dev:<any-id>` names. Run the nightly worksheet
step by hand with:

```bash
curl -X POST -H 'X-Batch-Token: dev' localhost:8080/internal/batch/worksheets/submit
curl -X POST -H 'X-Batch-Token: dev' localhost:8080/internal/batch/worksheets/collect
```

Frontend against that backend, in `.env.local` at the repo root:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_AUTH_MODE=dev
```

then `npm install && npm run dev` and open http://localhost:3000. With no
`.env.local` at all the site runs on demo data, which is fine for pure UI work.

## 6. Ground rules

- Pillar and affect names are the pipeline spec's (above). Do not rename them in the UI.
- Storage is Firestore (not Postgres). Everything runs in `northamerica-northeast1`.
- No student names in prompts, logs, traces or batch files. Use `stu_` ids.
- Photo checks run twice: in the browser (`lib/imageQuality.ts`) and on the
  server. Keep the limits the same in both.
