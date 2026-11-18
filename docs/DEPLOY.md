# Auto-deploy from `main`

Merging to `main` makes the change live. No one shares a key with Claude; a Cloud Build trigger in `birdbrain-514606` does the work as its own service account (`birdbrains-deployer`).

## What runs on every merge (`deploy/cloudbuild.yaml`)
1. `test-backend`: backend pytest. A failure stops the build; nothing ships.
2. `build-site`: `npm run build` (Next.js static export).
3. `build-api-image` / `push-api-image`: container image to Artifact Registry (`cloud-run-source-deploy`).
4. `deploy-api`: `gcloud run deploy --image` on `birdbrains-api` (northamerica-northeast1). Env vars and secrets on the service are kept.
5. `health-check`: calls the API health URL; fails the build if it is not OK.
6. `publish-site`: `deploy/hosting_deploy.py` uploads `out/` to Firebase Hosting (REST API, metadata-server token).

The trigger only fires when files that matter change (`--included-files` in `deploy/setup-auto-deploy.sh`), so docs-only merges don't deploy.

## One-time setup
1. Cloud Build console > Repositories > connect `TallPeasley/birdbrains` (browser click, GitHub approval).
2. Cloud Shell: `cd ~/birdbrains && git pull && ./deploy/setup-auto-deploy.sh`
3. Test: `gcloud builds triggers run birdbrains-main --branch=main`

## Rollback
- API: Cloud Run > `birdbrains-api` > Revisions > send 100% traffic to the previous revision.
- Site: Firebase console > Hosting > release history > Rollback.

## Turn it off
`gcloud builds triggers update github birdbrains-main --disabled` (or delete the trigger). Manual deploys (`backend/deploy.sh`, `deploy-web.sh`) still work.

## Status
Written and syntax-checked, but NOT yet run against real GCP/Firebase. Expect to fix a permission or flag on the first run.
