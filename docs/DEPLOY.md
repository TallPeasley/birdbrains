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
2. On Maalik's PC, in `Aero Sites\bb-deploy-main` moved to `origin/main`, after he types "go": `./deploy/setup-auto-deploy.sh`
   (deploys and deploy setup run only from the PC since 2026-11-19, never from Cloud Shell)
3. Test: `gcloud builds triggers run birdbrains-main --branch=main`

## Rollback
- API: Cloud Run > `birdbrains-api` > Revisions > send 100% traffic to the previous revision.
- Site: Firebase console > Hosting > release history > Rollback.

## Turn it off
`gcloud builds triggers update github birdbrains-main --disabled` (or delete the trigger). Manual deploys (`backend/deploy.sh`, `deploy-web.sh`) still work.

## Status
Written and syntax-checked, but NOT yet run against real GCP/Firebase. Expect to fix a permission or flag on the first run.

## Site address (quark.study, since 2026-11-27)

The main address is **https://quark.study**, a custom domain on Firebase Hosting project `boson-quark`.
https://www.quark.study and https://quark.boson.systems are Firebase Hosting redirects to
https://quark.study. https://boson-quark.web.app and https://birdbrain-514606.web.app keep serving the
same build. The API, Firestore, Storage and Firebase Auth stay in `birdbrain-514606`, so the site is
still built with that project's Firebase web config. `deploy-web.sh` (and Cloud Build) publish the
same build to both `boson-quark` and `birdbrain-514606`; canonical links, the sitemap and robots.txt
point search engines at https://quark.study. The API's `BIRDBRAINS_SITE_URL` (Stripe and Classroom
return pages) is https://quark.study, and CORS allows quark.study, www.quark.study and every
web.app / firebaseapp.com address.

**Order matters.** Connect quark.study in Firebase Hosting (and wait for the certificate) before
deploying this code. If you must deploy first, run `SITE_URL=https://boson-quark.web.app ./deploy-web.sh`
so Stripe and Classroom send people back to an address that works, and run it again without
`SITE_URL` once quark.study is live.

One-time console steps (cannot be done from the repo; DNS and custom domains wait for Maalik's cutover "go"):

1. Firebase console, project **boson-quark** > Hosting > Add custom domain: `quark.study`. Add
   `www.quark.study` as a redirect to it, and `quark.boson.systems` as a redirect to
   `https://quark.study`. Paste the `TXT` and `A` records Firebase shows into Spaceship > Advanced DNS
   (`@` for quark.study, `www` for www.quark.study; `quark` in the boson.systems zone).
2. Firebase console, project **birdbrain-514606** > Authentication > Settings > Authorized domains >
   Add domain: `quark.study` (keep `boson-quark.web.app`). Without it Google and Microsoft sign-in
   fail on quark.study.
3. Google Cloud console, project **birdbrain-514606** > APIs & Services > Credentials > the
   "Browser key (auto created by Firebase)": if it has Website restrictions, add `https://quark.study/*`
   (keep `https://boson-quark.web.app/*`).
4. Google Auth Platform (birdbrain-514606) > Branding: set the home page to `https://quark.study`
   and add `quark.study` under Authorized domains. The Classroom redirect URI is the API's
   `/classroom/callback` and does not change. Canvas and Brightspace redirect URIs are on the API too
   (`/lms/canvas/callback`, `/lms/brightspace/callback`); see docs/LMS.md.
5. After the API and site are deployed with quark.study: Stripe > Settings > Billing > Customer portal:
   rerun `python backend/tools/stripe_setup.py --price 10` (its default site URL is now
   https://quark.study, so it sets the portal's return link there), or change "Default redirect link"
   by hand. Needs the Stripe key, so Maalik runs it on his PC.
6. Signed-in people are signed in per address: anyone who opens quark.study signs in once again.
