#!/usr/bin/env bash
# Build the BirdBrains site and publish it to Firebase Hosting.
#
#   ./deploy-web.sh [gcp-project-id]
#
# The API, Firestore and sign-in live in the GCP project (birdbrain-514606). The site is
# published to every Firebase project in HOSTING_PROJECTS: boson-quark first (the main
# address, https://boson-quark.web.app), then the GCP project itself so the first address
# keeps working. Override with HOSTING_PROJECTS="boson-quark" ./deploy-web.sh to skip one.
#
# Run from Cloud Shell (or any machine with gcloud, node 20+ and npm), signed in as a
# project owner. It:
#   1. reads the API URL from Cloud Run and the Firebase web config from Firebase,
#   2. builds the static site with those values,
#   3. lets the API accept calls from the new address (CORS) and send people back to it,
#   4. deploys to https://boson-quark.web.app and https://<project>.web.app.
# Safe to run again; each run is one new Hosting release (roll back in the console).
set -euo pipefail

PROJECT="${1:-birdbrain-514606}"
REGION="northamerica-northeast1"
SERVICE="birdbrains-api"
HOSTING_PROJECTS="${HOSTING_PROJECTS:-boson-quark $PROJECT}"
MAIN_HOSTING="${HOSTING_PROJECTS%% *}"
SITE="https://${MAIN_HOSTING}.web.app"
# Every address the site is served from may call the API.
ORIGINS=""
for h in $HOSTING_PROJECTS; do ORIGINS="$ORIGINS,https://$h.web.app,https://$h.firebaseapp.com"; done
ORIGINS="${ORIGINS#,}"
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

echo "== Pointing the API at the site address ($SITE)"
# ^;^ switches gcloud's list separator so the comma-separated origin list survives.
gcloud run services update "$SERVICE" --region "$REGION" \
  --update-env-vars "^;^BIRDBRAINS_CORS_ORIGINS=$ORIGINS,$OLD_SITE;BIRDBRAINS_SITE_URL=$SITE" >/dev/null

# Uses your gcloud sign-in. If firebase-tools asks you to log in, run: npx firebase-tools login --no-localhost
for h in $HOSTING_PROJECTS; do
  echo "== Deploying to Firebase Hosting: $h"
  npx --yes firebase-tools@14 deploy --only hosting --project "$h" --non-interactive
done

echo
echo "Site is live at: $SITE"
for h in $HOSTING_PROJECTS; do [ "$h" = "$MAIN_HOSTING" ] || echo "         and at: https://$h.web.app"; done
