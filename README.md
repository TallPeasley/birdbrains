# BirdBrains web

Next.js 15 (App Router) + React 19 + Tailwind CSS 3 frontend built from the BirdBrains UI/UX spec, plus a Python backend in [`backend/`](backend/README.md). Team roles, branch rules and the API contract: [`docs/TEAM.md`](docs/TEAM.md).

With no environment variables set the site runs on demo data from `mocks/birdBrainsMockData.json`. Set `NEXT_PUBLIC_API_URL` (see `.env.example`) and it switches to real sign-in, real uploads and live dashboards.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Routes

| Route | What it is |
|---|---|
| `/` | Split hero (4-pillar framework) + quick sign-in with Student / Parent demo personas |
| `/student` | Affect & mindset card, four-pillar scores, step-by-step error localization with carry-forward badges, 3-stage worksheet (A: Diagnostic Mirror, B: Faded Scaffolding, C: Independent Transfer + checklist) |
| `/parent` | Friction alerts with at-home prompts, EWMA mastery chart with 2-week projection, EQAO Level 1–4 forecast, pillar error distribution |
| Capture modal | "Upload Work" button on every page. Student ID, course (MTH1W / MPM2D), unit + topic tags, multi-file drag-and-drop. Each photo is checked in the browser for resolution (shorter side ≥ 1080px) and sharpness (variance of the Laplacian) and rated Excellent / Acceptable / Too Blurry. Submitting builds a `SubmissionIngestionPayload` and walks through Uploading → Pre-Checking Sharpness → Ingesting via Pipeline → Processing Diagnostic. |

The Student / Parent toggle in the navbar switches views with client-side navigation (no reload).

## Layout

```
app/                 layout (navbar, FAB, modal), pages
components/student/  AffectCard, PillarCards, StepDiagnostics, WorksheetViewer
components/parent/   MasteryChart, EqaoForecast, PillarErrorChart, FrictionAlerts
components/          Navbar, CaptureFab, CaptureModal
lib/imageQuality.ts  resolution + Laplacian-variance blur check
lib/projections.ts   EWMA trend projection, EQAO probability spread
lib/mockData.ts      typed access to the mock payloads (demo mode)
lib/api.ts           API client
lib/session.tsx      sign-in state (Firebase), active student
backend/             Python API + AI pipeline (see backend/README.md)
types/birdBrains.ts  interfaces from the UI spec, with the pipeline spec's pillar and affect names
mocks/               mock payload pack from the spec, renamed to match
```

## Demo mode vs live mode

| | Demo (no `NEXT_PUBLIC_API_URL`) | Live |
|---|---|---|
| Sign-in | Demo personas | Email + password (Firebase Auth), student or parent. Students get a link code; parents enter it to follow their child |
| Upload | Simulated with timers | Photos go to the API, which re-checks quality, then runs the two-stage diagnostic |
| Dashboards | Mock payloads | Latest grading, worksheet (built overnight) and parent summary from the API |

Pillars and affect states use the AI pipeline spec's names: `CON`, `PRC`, `FAC`, `TST` and the five affect states.

## Known gaps

- Blur thresholds (`BLURRY_BELOW`, `EXCELLENT_ABOVE` in `lib/imageQuality.ts`) are first guesses and should be tuned on real phone photos.
- The parent payload only has a single EQAO level + confidence, so the Level 1–4 bars spread the remaining probability by distance from the forecast. The EWMA projection is also computed client-side from history.
- The student dashboard shows the latest diagnostic only; there is no history view yet.
