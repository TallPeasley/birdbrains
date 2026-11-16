#!/usr/bin/env bash
# Build the BirdBrains site and publish it to Firebase Hosting.
#
#   ./deploy-web.sh [gcp-project-id]
#
# Run from Cloud Shell (or any machine with gcloud, node 20+ and npm), signed in as a
# project owner. It:
#   1. reads the API URL from Cloud Run and the Firebase web config from Firebase,
#   2. builds the static site with those values,
#   3. lets the API accept calls from the new address (CORS) and send people back to it,
#   4. deploys to https://<project>.web.app.
# Safe to run again; each run is one new Hosting release (roll back in the console).
set -euo pipefail

PROJECT="${1:-birdbrain-514606}"
REGION="northamerica-northeast1"
SERVICE="birdbrains-api"
SITE="https://${PROJECT}.web.app"
# Kept allowed while the old Netlify address is still in use. Drop it once Netlify is gone.
OLD_SITE="https://birdbrains.netlify.app"
cd "$(dirname "$0")"

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable firebasehosting.googleapis.com firebase.googleapis.com >/dev/null

echo "== Reading the API URL and Firebase web config"
API_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
TOKEN="$(gcloud auth print-access-token)"
FB="https://firebase.googleapis.com/v1beta1/projects/$PROJECT/webApps"
APP="$(curl -fsS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" "$FB" \
  | python3 -c 'import json,sys; a=json.load(sys.stdin).get("apps",[]); print(a[0]["name"] if a else "")')"
if [ -z "$APP" ]; then
  echo "No Firebase web app found. Firebase console > Project settings > Your apps > add a Web app, then rerun." >&2
  exit 1
fi
CONFIG="$(curl -fsS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
  "https://firebase.googleapis.com/v1beta1/$APP/config")"
cfg() { python3 -c "import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2],''))" "$CONFIG" "$1"; }

export NEXT_PUBLIC_API_URL="$API_URL"
export NEXT_PUBLIC_FIREBASE_API_KEY="$(cfg apiKey)"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$(cfg authDomain)"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="$(cfg projectId)"
echo "   API: $NEXT_PUBLIC_API_URL"
echo "   Firebase project: $NEXT_PUBLIC_FIREBASE_PROJECT_ID"

echo "== Building the site"
npm ci --no-audit --no-fund
npm run build

echo "== Pointing the API at the new site address"
# ^;^ switches gcloud's list separator so the comma-separated origin list survives.
gcloud run services update "$SERVICE" --region "$REGION" \
  --update-env-vars "^;^BIRDBRAINS_CORS_ORIGINS=$SITE,https://${PROJECT}.firebaseapp.com,$OLD_SITE;BIRDBRAINS_SITE_URL=$SITE" >/dev/null

echo "== Deploying to Firebase Hosting"
# Uses your gcloud sign-in. If firebase-tools asks you to log in, run: npx firebase-tools login --no-localhost
npx --yes firebase-tools@14 deploy --only hosting --project "$PROJECT" --non-interactive

echo
echo "Site is live at: $SITE"
