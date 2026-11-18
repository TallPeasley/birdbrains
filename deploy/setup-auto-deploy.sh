#!/usr/bin/env bash
# One-time setup: every merge to main that touches the API or the site deploys itself.
#
#   cd ~/birdbrains && git pull && ./deploy/setup-auto-deploy.sh [gcp-project-id]
#
# Run in Cloud Shell as a project owner, after backend/deploy.sh and deploy-web.sh have
# worked once. Safe to run again. No key is created: the build runs as its own service
# account and nobody, including Claude, ever holds a credential for it.
#
# What it does:
#   1. enables Cloud Build, Artifact Registry, Cloud Run and Firebase Hosting APIs,
#   2. creates the build service account `birdbrains-deployer` with only the roles a deploy needs,
#   3. creates a Cloud Build trigger on the main branch of TallPeasley/birdbrains.
# One click it cannot do for you: connect the GitHub repository to Cloud Build (it tells you).
set -euo pipefail

PROJECT="${1:-birdbrain-514606}"
REGION="northamerica-northeast1"
SERVICE="birdbrains-api"
RUNTIME_SA="birdbrains-api@${PROJECT}.iam.gserviceaccount.com"
DEPLOYER="birdbrains-deployer@${PROJECT}.iam.gserviceaccount.com"
OWNER="TallPeasley"; REPO="birdbrains"
cd "$(dirname "$0")/.."

gcloud config set project "$PROJECT" >/dev/null
echo "== Enabling APIs"
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com \
  firebasehosting.googleapis.com firebase.googleapis.com serviceusage.googleapis.com >/dev/null

echo "== Build service account (least privilege)"
gcloud iam service-accounts describe "$DEPLOYER" >/dev/null 2>&1 || \
  gcloud iam service-accounts create birdbrains-deployer --display-name="BirdBrains auto-deploy (Cloud Build)"
for role in roles/run.admin roles/artifactregistry.writer roles/firebasehosting.admin \
            roles/logging.logWriter roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$DEPLOYER" --role="$role" \
    --condition=None >/dev/null
done
# Needed to deploy a service that runs as the API's account. Only that one account, not the project.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$DEPLOYER" \
  --role=roles/iam.serviceAccountUser >/dev/null

echo "== Reading the public values the site is built with"
API_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
TOKEN="$(gcloud auth print-access-token)"
FB="https://firebase.googleapis.com/v1beta1/projects/$PROJECT/webApps"
APP="$(curl -fsS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" "$FB" \
  | python3 -c 'import json,sys; a=json.load(sys.stdin).get("apps",[]); print(a[0]["name"] if a else "")')"
[ -n "$APP" ] || { echo "No Firebase web app found. Add one in the Firebase console, then rerun." >&2; exit 1; }
CONFIG="$(curl -fsS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
  "https://firebase.googleapis.com/v1beta1/$APP/config")"
cfg() { python3 -c "import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2],''))" "$CONFIG" "$1"; }
SUBS="_API_URL=$API_URL,_FIREBASE_API_KEY=$(cfg apiKey),_FIREBASE_AUTH_DOMAIN=$(cfg authDomain)"

echo "== Trigger on main"
# Only changes to the API or the site deploy; docs-only merges do not.
INCLUDED='backend/**,app/**,components/**,lib/**,types/**,mocks/**,package.json,package-lock.json,next.config.mjs,tailwind.config.ts,postcss.config.mjs,tsconfig.json,firebase.json,deploy/**'
if gcloud builds triggers describe birdbrains-main >/dev/null 2>&1; then
  echo "   trigger birdbrains-main already exists (delete it in the console to recreate)"
elif ! gcloud builds triggers create github --name=birdbrains-main \
      --repo-owner="$OWNER" --repo-name="$REPO" --branch-pattern='^main$' \
      --build-config=deploy/cloudbuild.yaml --included-files="$INCLUDED" \
      --service-account="projects/$PROJECT/serviceAccounts/$DEPLOYER" --substitutions="$SUBS"; then
  cat >&2 <<MSG

The GitHub repository is not connected to Cloud Build yet. One time, in the browser:
  Cloud console > Cloud Build > Triggers > "Connect repository" > GitHub (Cloud Build GitHub App)
  > sign in to GitHub, choose $OWNER/$REPO, then "Connect". Skip the "create a trigger" step it offers.
Then rerun this script.
MSG
  exit 1
fi

cat <<MSG

Done. From now on, a merge to main that changes the API or the site is deployed automatically.
  Watch builds : https://console.cloud.google.com/cloud-build/builds?project=$PROJECT
  Turn it off  : Cloud Build > Triggers > birdbrains-main > Disable
  Roll back    : see docs/DEPLOY.md
To test it now without a merge: gcloud builds triggers run birdbrains-main --branch=main
MSG
