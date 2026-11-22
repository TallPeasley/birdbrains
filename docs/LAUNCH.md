# Launch checklist and runbook

For launch day (Mon Dec 14, 2026) and the pilot weeks after it. Commands run in
Google Cloud Shell from the repo folder unless it says otherwise.

## 1. Launch checklist

### Deploy and configuration
- [ ] `main` is deployed: `git pull && ./backend/deploy.sh birdbrain-514606` finished without errors.
- [ ] `curl https://birdbrains-api-28737473918.northamerica-northeast1.run.app/health` returns `{"ok":true}`.
- [ ] The live site (Firebase Hosting) was published by `./deploy-web.sh` from the latest `main`.
- [ ] Firebase Auth: the site's domain is in Authorized domains (`web.app` is there by default; add any custom domain); email sign-up works on a phone.
- [ ] `./backend/monitoring.sh birdbrain-514606 <your email>` has been run and the alert email is confirmed.
- [ ] Billing budget alert exists (Billing > Budgets) for the project.
- [ ] If Pro is paid at launch: the three Stripe secrets exist, the webhook points at `/billing/webhook`, and a test-card upgrade flips an account to Pro. Then switch Stripe to live keys and redeploy.
- [ ] If Classroom is on: OAuth consent screen lists the pilot teachers as test users.

### Quality gates
- [ ] `cd backend && pytest` and `npm run build` pass on `main`.
- [ ] Accuracy report (`python -m ai_eval --engine gemini`) passes the release gates on the 80-sample gold set, for Pro and for Free.
- [ ] Smoke test passes (sign-up, upload checks, Free cap, Pro features, privacy, deletion): `python backend/tools/smoke_test.py --url <api> --firebase-key <web API key> --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"`. It makes its own test accounts and deletes them.
- [ ] Load test passes: `python backend/tools/load_test.py --url <api> --token <token> --student-id <id>` (30 uploads at once, all graded within 45 s).
- [ ] Five generated worksheets were read by a tutor and are right.
- [ ] The go/no-go walkthrough is done on a phone as a Free student, a Pro student and a parent.

### Privacy
- [ ] Privacy policy and terms are published and the open points in `docs/legal/README.md` are closed.
- [ ] Sign-up shows the consent checkbox (parent consent under 13).
- [ ] Section 3 below (privacy audit on the live project) is all green.

### People
- [ ] Pilot users chosen; who starts on Pro is set (`POST /internal/users/{uid}/plan` or Stripe).
- [ ] Invite message sent by Maalik (draft: `docs/pilot/invite.md`).

## 2. Runbook

### Where to look
| What | Where |
|---|---|
| Dashboard (cost per plan, speed, errors) | Cloud console > Monitoring > Dashboards > BirdBrains |
| API logs | Cloud console > Cloud Run > birdbrains-api > Logs |
| One line per graded upload | Logs filter: `jsonPayload.event="pipeline_done"` |
| Nightly worksheet jobs | Cloud Scheduler: `birdbrains-worksheets-submit` (1:00) and `-collect` (every 30 min, all day, Toronto time; a slow batch job is picked up when it finishes) |
| Stripe events | Stripe dashboard > Developers > Webhooks |

### Daily pilot summary
```bash
cd backend && python tools/pilot_summary.py --url <api> --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
```
Prints yesterday's sign-ups, uploads by plan and result, students who hit the Free cap, the most
common error codes, model cost per plan and speed, and anything worth a look. Counts only, no names.
Add `--days 7` for the week.

### Alerts and what to do
| Alert | Likely cause | First step |
|---|---|---|
| API is down | Bad deploy, or Cloud Run cannot start | Cloud Run > Revisions: send traffic back to the previous revision (below). |
| Server errors | Vertex AI or Firestore failing; a bug in a new release | Read the newest error in Logs. Uploads that failed show "failed, try again" to the student and can be retried; nothing is lost. |
| Diagnostics are slow | Vertex AI latency, or a burst of uploads | Check the speed chart by plan. If only Pro is slow, lower `STAGE2_THINKING_BUDGET` or wait; Free uses Flash and is not affected. |
| Model spend is high | Many uploads, or a loop retrying | Check uploads per plan. To stop spend at once, see "Pause grading". |

### Roll back a bad release
```bash
gcloud run revisions list --service birdbrains-api --region northamerica-northeast1 --limit 5
gcloud run services update-traffic birdbrains-api --region northamerica-northeast1 --to-revisions <previous-revision>=100
```
The site (Firebase Hosting): Firebase console > Hosting > Release history > pick the last good release > Roll back.

### Pause grading (stops model spend, keeps sign-in and results working)
```bash
gcloud run services update birdbrains-api --region northamerica-northeast1 --update-env-vars BIRDBRAINS_FREE_MONTHLY_SUBMISSIONS=0
```
That stops new Free uploads with the "limit reached" screen; Pro keeps working. To stop
all traffic, take away public access (sign-in and results stop too):
```bash
gcloud run services remove-iam-policy-binding birdbrains-api --region northamerica-northeast1 --member=allUsers --role=roles/run.invoker
```
Put it back with `add-iam-policy-binding` and the same arguments.

### Common requests
- **Make someone Pro / Free**: `curl -X POST <api>/internal/users/<uid>/plan -H "X-Batch-Token: $(gcloud secrets versions access latest --secret=birdbrains-batch-token)" -H 'content-type: application/json' -d '{"plan":"pro"}'`. The uid is in Firebase console > Authentication.
- **Delete a student's data on request**: the student or parent uses "Delete my data" in settings. It removes photos, results, worksheets, the ledger and the account at once.
- **A worksheet did not arrive**: worksheets are made overnight for Pro students whose upload had at least one root-cause error. A worksheet that fails its checks is retried the next night, up to the retry limit, then marked failed.
- **Wrong diagnosis reported**: note the upload, the code given and the right code. These go into the gold set and become prompt examples.

## 3. Privacy audit on the live project

The code side is tested on every change (`backend/tests/test_eval_and_reports.py::test_no_names_reach_the_model_the_batch_file_or_the_logs`, the photo-blur tests and the delete tests). These checks confirm the live project matches.

- [ ] **Everything is in Montréal.** Each of these prints `northamerica-northeast1` (upper or lower case):
  ```bash
  gcloud run services list --format='value(metadata.name,region)'
  gcloud storage buckets describe gs://birdbrain-514606-birdbrains --format='value(location)'
  gcloud firestore databases describe --database='(default)' --format='value(locationId)'
  gcloud secrets list --format='value(name,replication.userManaged.replicas[0].location)'
  gcloud scheduler jobs list --location northamerica-northeast1 --format='value(name)'
  ```
  Vertex AI calls are pinned to Montréal in code (`VERTEX_LOCATION`) and cannot be changed by configuration. Known exception to tell users about: Firebase Authentication stores sign-in emails outside Canada (noted in the privacy policy draft).
- [ ] **No names in logs.** In Logs Explorer search the last 7 days for a pilot student's first name and for their email. Expected: no results.
- [ ] **No names in batch files.** `gcloud storage cat $(gcloud storage ls gs://birdbrain-514606-birdbrains/batch/ | tail -n1)requests.jsonl | head -c 3000` shows error codes and maths only.
- [ ] **Photos are blurred where names were.** Upload a page with a name on it; the stored photo shown on the result page has the name blurred.
- [ ] **Photos expire.** `gcloud storage buckets describe gs://birdbrain-514606-birdbrains --format='value(lifecycle_config)'` shows the 90-day delete rule for `submissions/`.
- [ ] **Deletion works.** Create a throwaway account, upload once, use "Delete my data", then confirm the account is gone from Firebase Authentication and `gcloud storage ls gs://birdbrain-514606-birdbrains/submissions/<studentId>/` is empty.
- [ ] **The bucket is private.** `gcloud storage buckets describe gs://birdbrain-514606-birdbrains --format='value(public_access_prevention)'` prints `enforced`.
