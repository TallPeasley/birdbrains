# BirdBrains launch plan (task list)

> **Snapshot of the TickTick list 🐦BirdBrains, taken 2026-11-13 22:15 Toronto time.** TickTick is the source of truth. Claude refreshes this file whenever the plan changes; if the two disagree, TickTick wins.

Launch: **Mon Dec 14, 2026**. Who owns which folders, the branch rules and the API contract are in [`docs/TEAM.md`](TEAM.md). Plans (Free vs Pro) are described in TEAM.md under "Plans".

## For Gemini (Antigravity): how to use this file

1. Work only on tasks that start with **`Gemini:`**. Leave Maalik, Claude and Freelancer tasks alone; if your task needs something from one of them, say so in your PR.
2. One task per PR, on a **`gemini/*` branch** (for example `gemini/plans-upgrade-screens`). Never push to `main`; Maalik merges your PRs after Claude checks them.
3. In that PR, tick your task in this file (`- [ ]` becomes `- [x]`) and put the task title in the PR title.
4. Stay inside your folders from TEAM.md (`app/`, `components/`, `extension/`, `public/`, styles). Build against `lib/api.ts` and `types/birdBrains.ts`; if an endpoint or field is missing, use mock data and list what's missing in the PR.
5. Before opening the PR: `npm run build` passes and demo mode (no `NEXT_PUBLIC_API_URL`) still works.
6. Dates are targets. You may start a later Gemini task early when its API is ready (TEAM.md section 8 lists which endpoints are done).

Counts: 65 tasks. Maalik 28, Claude 14, Gemini 13, Freelancer 10. The freelancer is not confirmed yet (decision due Nov 17); until then Claude covers Freelancer tasks on the same dates. Human review (a teacher review queue) is out for launch.

## Week 1 (Nov 13 to 19): Set up the team, make what's built real

- [x] **Fri Nov 13** · **Maalik:** Merge PR 1, then PR 2. github.com/TallPeasley/birdbrains pull 1, then pull 2 (deploy fixes, stacked on 1). Merge after the first upload works. Gemini and the freelancer should start from main, so this unblocks them.
- [ ] **Fri Nov 13** · **Maalik:** First real upload on the live site. Sign up at birdbrains.netlify.app as a student, upload one real worksheet photo from your phone, wait for the diagnostic. Screenshot the result and send it to Claude in the BirdBrain project. This is the first real Gemini call.
- [x] **Fri Nov 13** · **Claude:** Swap in the official 16 error codes. Gemini's Freelancer Manual section 2.1 has the official codes (CON, PRC, FAC, TST, each 01 to 04). Replace the draft in backend/birdbrains/taxonomy.py and the frontend labels, then redeploy. Also fix whatever the first live upload shows.
- [ ] **Sat Nov 14** · **Maalik:** Take 12 test photos for the blur check. Phone photos of real math work: 4 sharp, 4 slightly blurry, 4 dim or angled. Drop them in the project chat.
- [ ] **Sat Nov 14** · **Maalik:** GCP budget alert + Netlify repo link. 1) Cloud console > Billing > Budgets: alert for birdbrain-514606 (e.g. $25/month, at 50/90/100%). 2) Netlify > birdbrains > Link repository (TallPeasley/birdbrains). With three contributors, auto-deploys matter more now. Each push uses Netlify build credits; they reset on the 14th.
- [ ] **Sat Nov 14** · **Maalik:** Set up Gemini (Antigravity) on the repo. Open TallPeasley/birdbrains in Google Antigravity and point it at docs/PLAN.md and docs/TEAM.md. It takes only 'Gemini:' tasks, pushes gemini/* branches, ticks its task in docs/PLAN.md in the PR, and you merge.
- [x] **Sat Nov 14** · **Claude:** Write the team handoff doc (docs/TEAM.md). Who owns what: Gemini owns the UI (app/, components/, the Chrome extension); Claude owns the API, infrastructure and privacy (backend/ except the AI pipeline, lib/api.ts); the freelancer owns the AI pipeline (pipeline, taxonomy, prompts, eval). Includes the API contract with example responses, branch and PR rules, and how to run locally with the fake model.
- [ ] **Sun Nov 15** · **Maalik:** Gold set: collect 10 labelled samples. 10 photos of solved problems with mistakes (your own, or tutoring work with consent, names covered). For each: the correct answer and the error codes you'd give (the 16 codes). A simple sheet is fine. Target: 25 by Nov 21, 80 by Dec 8.
- [ ] **Sun Nov 15** · **Gemini:** Upload flow states. In the upload modal: clear screens for uploading, checking photo, too blurry (retake tips), duplicate photo, diagnosing (progress), and failed. Use the error codes in docs/TEAM.md. Mobile first.
- [ ] **Mon Nov 16** · **Maalik:** Decide: Google Classroom before launch? Classroom is Pro-only in the pricing brief. Its API scopes need Google OAuth verification, which can take weeks. If yes, create the OAuth consent screen in birdbrain-514606 now (Claude can walk you through it). If no, the Classroom tasks move after launch.
- [ ] **Mon Nov 16** · **Claude:** Tune blur cutoffs + duplicate upload check. Use Maalik's 12 photos to set the sharpness and size limits (spec: Laplacian variance at least 100, at least 800x600) on server and phone. Add the SHA-256 duplicate check (UT-06, HTTP 409). Run UT-01 to UT-07.
- [ ] **Tue Nov 17** · **Maalik:** Review and merge week-1 PRs. Claude's backend PR and Gemini's upload-states PR. Merge Claude's first, then rerun backend/deploy.sh in Cloud Shell (it now enables the DLP API).
- [ ] **Tue Nov 17** · **Maalik:** Confirm the freelancer: yes or no. Tell Claude whether the freelancer (Gemini's manual names Luca Trinchini) is joining. If yes: send him docs/TEAM.md and the Drive manual, and give him repo access. If no: every 'Freelancer:' task goes to Claude on the same date. No other dates change.
- [x] **Tue Nov 17** · **Claude:** Privacy: hide names before storage and Gemini. Spec 3.2: crop or redact the top 12% header and run Cloud DLP redaction before saving to Cloud Storage; 15-minute signed URLs; 90-day lifecycle on raw photos; check no names reach Vertex logs or traces.
- [ ] **Wed Nov 18** · **Maalik:** Decide how people get Pro, the price and the Free cap. Billing isn't in the pricing brief. Choose: (a) paid Pro at launch through Stripe subscriptions, (b) Pro by invite code for the pilot, payments later, or (c) everyone on Pro free during the pilot. Also set the Free monthly upload cap (Freelancer's Nov 20 cost numbers help) and the Pro price. Tell Claude.
- [x] **Wed Nov 18** · **Claude:** Schools, classes and data deletion (API). Spec 5.3 and 3.3: tenants, schools, classrooms (grades 3 to 12) in Firestore, tenant checks on every query, delete-my-data endpoint, class join codes. Endpoints added to docs/TEAM.md for Gemini.
- [ ] **Wed Nov 18** · **Freelancer:** Onboard: run the pipeline locally. Read the Drive manual and docs/TEAM.md, run backend tests and the fake-model flow, then one real Vertex call. Own from here: pipeline.py, taxonomy.py, prompts, ai_eval.
- [ ] **Thu Nov 19** · **Maalik:** Week 1 exit check (20 min). On your phone: sign up, upload a sharp photo (diagnostic arrives), a blurry one (rejected with tips), the same photo twice (rejected), a page with your name on it (name hidden). Report anything off.
- [ ] **Thu Nov 19** · **Gemini:** Account and settings screens. Profile, current plan and uploads used this month, parent linking, join a class with a code, and 'Delete my data' (with confirm). Uses Claude's Nov 18 endpoints.

## Week 2 (Nov 20 to 26): AI accuracy, plans and limits

- [ ] **Fri Nov 20** · **Gemini:** Student and parent dashboards on real data. Loading, empty (no uploads yet) and error states; mobile layout; the 16 codes in plain words with the pillar colours.
- [ ] **Fri Nov 20** · **Freelancer:** Check the context cache, tracing and cost per upload. Confirm the 24 h CachedContent is created and used on Vertex, pick where MLflow traces go, and log real cost per submission for Free (Flash) and Pro (Pro + thinking + mood) against the ~$0.0045 target. This sets the Free cap.
- [ ] **Sat Nov 21** · **Maalik:** Gold set: 15 more samples (25 total). Same format as Nov 15. Mix grades and topics; include at least 3 'step skipped' vs 'math fact slip' pairs (PRC-01 vs FAC-01).
- [ ] **Sun Nov 22** · **Maalik:** Create a Stripe account (only if paying at launch). Only if you chose paid Pro: create a Stripe account in test mode, add the Pro product and monthly price, and give Claude test keys through Cloud Shell secrets (not in chat). Skip otherwise.
- [ ] **Mon Nov 23** · **Claude:** Plans and monthly limits in the backend. Per the pricing brief: a plan on every account (Free or Pro), a monthly upload counter with a hard Free cap (number from Maalik's Nov 18 decision), clear 'limit reached' and 'Pro only' errors, and feature gates: Free gets Flash transcription, 4-pillar error codes and standard feedback; Pro adds mood tracking (valence and friction), speed bumps and de-escalation, gemini-2.5-pro with thinking, nightly worksheets, LMS and analytics. Mood data is not stored for Free accounts. Contract in docs/TEAM.md. (Human review queue is out for launch.)
- [ ] **Mon Nov 23** · **Freelancer:** Build the accuracy test harness. ai_eval: runs the gold set through the live pipeline and reports schema pass rate, pillar F1, error-code F1, cascading-error accuracy and P95 latency, saved as a report.
- [ ] **Tue Nov 24** · **Maalik:** Review 5 misgraded samples (30 min). The freelancer (or Claude) sends the cases the AI got wrong. Say which grade is right; these become exemplars.
- [ ] **Tue Nov 24** · **Freelancer:** Prompt tuning round 1 (target 85% on 25). Tune Stage 1 and 2 prompts and few-shot exemplars until the 25-sample gold set reaches 85% (Phase 2 exit gate).
- [ ] **Wed Nov 25** · **Gemini:** Plans, usage and upgrade screens. Pricing page (Free vs Pro from the pricing brief), plan badge, uploads-left meter, an upgrade prompt when the Free cap is hit, and locked Pro cards (mood tracking, worksheets) with an upgrade button on Free dashboards. Built against Claude's Nov 23 contract.
- [ ] **Wed Nov 25** · **Freelancer:** Speed: diagnostic under 14 s. E2E-01: P95 from upload to diagnostic under 14 s. Profile Stage 1 and 2; Claude helps move work onto Cloud Tasks if needed.
- [ ] **Thu Nov 26** · **Maalik:** Week 2 exit check: accuracy + merges. Read the accuracy report; go or no-go on 85% for the 25 samples. Merge the week-2 PRs (freelancer/Claude pipeline, Gemini screens).

## Week 3 (Nov 27 to Dec 3): Upgrades, extension and Classroom (Pro)

- [ ] **Fri Nov 27** · **Claude:** Extension upload endpoint + Classroom sign-in. Signed-URL upload and status endpoints for the Chrome extension (Phase 3.1). Google Classroom OAuth on the backend, if Classroom is in for launch.
- [ ] **Fri Nov 27** · **Freelancer:** Free-plan pipeline mode. A cheaper Free path: Flash transcription and 4-pillar error codes with standard feedback, no mood tracking or thinking budget. Run the gold set on it so Free accuracy is known, and report cost per upload.
- [ ] **Sat Nov 28** · **Maalik:** Gold set: 15 more (40 total) + extension code. Label 15 more. Send the existing Chrome extension code to Gemini (the roadmap says one exists), or say there is none.
- [ ] **Mon Nov 30** · **Maalik:** Make a test Google Classroom. A test class with a test student account. Skip if Classroom moved to after launch.
- [ ] **Mon Nov 30** · **Claude:** Upgrades: Stripe or invite codes. Build what Maalik chose on Nov 18: Stripe Checkout plus a webhook that sets the plan (test mode first), or Pro invite codes, or nothing for an all-Pro pilot. Plan changes take effect on the next upload.
- [ ] **Mon Nov 30** · **Gemini:** Chrome extension. Capture or pick a page, upload through Claude's signed-URL endpoint, show status and a link to the result. Build a minimal one if none exists.
- [ ] **Tue Dec 1** · **Claude:** Google Classroom import (backend). Read assignments and student submissions from the test class into the pipeline. Canvas and Brightspace (LTI 1.3) are after launch; they need school developer accounts.
- [ ] **Tue Dec 1** · **Gemini:** Classroom connect screens (Pro). Pro teachers connect Google Classroom, pick a class and an assignment, and see imported work and results in the class view. Free accounts see an upgrade prompt.
- [ ] **Wed Dec 2** · **Maalik:** Test Free vs Pro (30 min). On a Free account: upload until the cap blocks you and check the upgrade prompt; no mood card shown. On a Pro account: mood tracking and speed bumps appear, the extension uploads, the test Classroom connects. Report issues.
- [ ] **Wed Dec 2** · **Gemini:** Checkout and manage-plan screens. Upgrade button to Stripe Checkout (or an invite-code box), success and cancel pages, and a manage-plan section in settings. Skip if the pilot is all-Pro.
- [ ] **Thu Dec 3** · **Maalik:** Week 3 exit check + merges. Free cap and Pro gates work end to end; uploads from the extension and the test Classroom reach grading for Pro. Merge week-3 PRs.

## Week 4 (Dec 4 to 9): Printable worksheets (Pro)

- [ ] **Fri Dec 4** · **Gemini:** Worksheet viewer and print layout. On-screen worksheet for students (3 stages, answer boxes) and an HTML print template Claude's PDF job will render.
- [ ] **Fri Dec 4** · **Freelancer:** Run the nightly worksheet batch for real (Pro). Vertex Batch API job in Montréal for flagged Pro students only, 3 stages: Diagnostic Mirror, Faded Scaffolding, Independent Transfer, with KaTeX syntax checks on the output.
- [ ] **Sat Dec 5** · **Maalik:** Review 5 generated worksheets. Read 5 real worksheets as a tutor: right level, right error, good scaffolding? Note fixes for the freelancer (or Claude).
- [ ] **Sun Dec 6** · **Maalik:** Gold set: 20 more (60 total). Fill the gaps the accuracy report shows (weak codes or grades).
- [ ] **Mon Dec 7** · **Claude:** PDF worksheets job. WeasyPrint on Cloud Run Jobs renders Gemini's print template to PDF each night; download links in the API (Phase 4.3).
- [ ] **Tue Dec 8** · **Maalik:** Gold set: last 20 (80 total). Finish the 80-sample set across grades 3 to 12 (Phase 5.1).
- [ ] **Tue Dec 8** · **Claude:** Draft privacy policy and terms. Plain-language privacy policy (PIPEDA, Canadian data residency, what is stored, mood data only on Pro, 90-day photo deletion, parental consent for minors) and terms of use, including plan, cap, billing and cancellation terms. Text for Gemini's pages.
- [ ] **Tue Dec 8** · **Gemini:** Legal pages + consent at sign-up. Privacy and terms pages from Claude's text, a consent checkbox at sign-up (parent consent for under-13s), PDF download buttons on worksheets.
- [ ] **Wed Dec 9** · **Maalik:** Week 4 exit check + merges. A flagged Pro student gets a print-ready PDF worksheet the next morning (E2E-03); a Free student does not. Merge week-4 PRs.

## Week 5 (Dec 10 to 14): Benchmarks, load test, launch

- [ ] **Thu Dec 10** · **Gemini:** Mobile and accessibility pass. Every screen at phone width, keyboard use, contrast, screen-reader labels, loading speed. Fix what fails.
- [ ] **Thu Dec 10** · **Freelancer:** Full accuracy run on 80 + tuning. ai_eval on all 80. Release gates: pillar F1 0.92, code F1 0.88, 100% schema pass, 95% cascading accuracy. Tune and report what passes.
- [ ] **Fri Dec 11** · **Maalik:** Review the policy, terms and prices. Read the drafts, change anything, approve. Confirm the Free cap and Pro price. Pick the first pilot users (e.g. your tutoring students and parents) and who gets Pro.
- [ ] **Fri Dec 11** · **Claude:** Load test, monitoring and alerts. E2E-02: 30 uploads at once finish under 45 s. Cloud Monitoring dashboard, error and cost alerts (cost per plan per day), uptime check on /health.
- [ ] **Sat Dec 12** · **Claude:** Privacy audit + launch checklist. No student names in Vertex logs, traces or batch files; deletion works; everything stays in northamerica-northeast1. Launch checklist and runbook.
- [ ] **Sat Dec 12** · **Gemini:** Homepage polish for launch. Landing page copy and visuals for families and tutors, a Free vs Pro pricing section, sign-up call to action, screenshots of real (anonymised) results.
- [ ] **Sun Dec 13** · **Maalik:** Go/no-go walkthrough (45 min). Full flow on your phone as a Free student, a Pro student and a parent: cap, upgrade, mood tracking, worksheet. Read the accuracy, cost and load reports. Decide: launch Monday or slip.
- [ ] **Mon Dec 14** · **Maalik:** Launch: invite the first pilot users. Send the invites yourself and set who starts on Pro. Watch the first day's uploads and costs on the monitoring dashboard.

## After launch

- [ ] **Wed Dec 16** · **Maalik:** Pilot week: spot-check results daily. Look at a few diagnoses each day and note any that are wrong (screenshot plus the right code), plus family feedback and how many hit the Free cap. Wrong ones feed v1.1.
- [ ] **Sat Dec 19** · **Gemini:** Fix the UI issues from pilot feedback. Work through the pilot's UI complaints list, most common first.
- [ ] **Sat Dec 19** · **Freelancer:** v1.1 exemplars from pilot mistakes. Turn the wrong diagnoses Maalik logged in pilot week into few-shot exemplars and rerun the accuracy suite on both Free and Pro modes.
- [ ] **Wed Dec 23** · **Freelancer:** Cost tuning + science curriculum. Optimise cache TTL and token budgets; add Grade 11 and 12 physics, chemistry and biology micro-skills (Gemini Week 7).
- [ ] **Wed Dec 30** · **Claude:** Reports API + LTI if schools sign on. Cohort and longitudinal mastery data for schools and tutors (Gemini Week 8). Canvas and Brightspace LTI 1.3 if school accounts exist.
- [ ] **Wed Dec 30** · **Gemini:** Class and progress report screens. Teacher class overview and a parent progress report over time, from Claude's reports API.
- [ ] **Tue Jan 5** · **Maalik:** Sign-off: review the pilot and next phase. Read the pilot summary (usage, accuracy, cost, issues) and choose what's next.
