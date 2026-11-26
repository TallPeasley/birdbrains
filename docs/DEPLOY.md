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

## Site address (since 2026-11-26)

The main address is https://boson-quark.web.app (Firebase project `boson-quark`). The API, Firestore,
Storage and Firebase Auth stay in `birdbrain-514606`, so the site is still built with that project's
Firebase web config. `deploy-web.sh` (and Cloud Build) publish the same build to both
`boson-quark` and `birdbrain-514606`, so https://birdbrain-514606.web.app keeps working; canonical
links point search engines at the new address. The API's `BIRDBRAINS_SITE_URL` (Stripe and Classroom
return pages) is the new address, and CORS allows both.

One-time console steps (cannot be done from the repo):

1. Firebase console, project **birdbrain-514606** > Authentication > Settings > Authorized domains >
   Add domain: `boson-quark.web.app`. Without it Google and Microsoft sign-in fail on the new address.
2. Google Cloud console, project **birdbrain-514606** > APIs & Services > Credentials > the
   "Browser key (auto created by Firebase)": if it has Website restrictions, add `https://boson-quark.web.app/*`.
3. Google Auth Platform (birdbrain-514606) > Branding: set the home page to `https://boson-quark.web.app`
   and add `boson-quark.web.app` under Authorized domains. The Classroom redirect URI is the API's
   `/classroom/callback` and does not change.
4. Stripe > Settings > Billing > Customer portal: rerun `python backend/tools/stripe_setup.py --price 10`
   (it now sets the portal's return link to the new address), or change "Default redirect link" by hand.
5. Signed-in people are signed in per address: anyone who opens the new address signs in once again.
