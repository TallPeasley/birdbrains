#!/usr/bin/env bash
# Deploy the BirdBrains API to Cloud Run in Montréal.
#
#   ./deploy.sh <gcp-project-id> [frontend-origin]
#
# Needs the gcloud CLI, signed in as a project owner, with billing enabled on the
# project. Safe to run again: existing resources are left alone.
set -euo pipefail

PROJECT="${1:?usage: ./deploy.sh <gcp-project-id> [frontend-origin]}"
ORIGIN="${2:-https://birdbrains.netlify.app}"
REGION="northamerica-northeast1"   # PIPEDA: everything stays in Montréal
SERVICE="birdbrains-api"
BUCKET="${PROJECT}-birdbrains"
SA="birdbrains-api@${PROJECT}.iam.gserviceaccount.com"
cd "$(dirname "$0")"

gcloud config set project "$PROJECT" >/dev/null
echo "== Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com identitytoolkit.googleapis.com \
  compute.googleapis.com

echo "== Storage bucket and Firestore (both in $REGION)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 || \
  gcloud firestore databases create --database="(default)" --location="$REGION" --type=firestore-native

echo "== Service account"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create birdbrains-api --display-name="BirdBrains API"
for role in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" \
    --condition=None >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" \
  --role=roles/storage.objectAdmin >/dev/null

echo "== Batch token (Secret Manager)"
if ! gcloud secrets describe birdbrains-batch-token >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create birdbrains-batch-token --data-file=- \
    --replication-policy=user-managed --locations="$REGION"
fi
gcloud secrets add-iam-policy-binding birdbrains-batch-token --member="serviceAccount:$SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null

echo "== Build permissions"
# New projects build source deploys as the default compute service account, which
# starts without build rights. Grant them, then give IAM a minute to propagate.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/run.builder --condition=None >/dev/null
sleep 60

echo "== Deploying to Cloud Run"
# --allow-unauthenticated: the browser calls the API directly; every route except
# /healthz checks a Firebase sign-in token (or the batch token) itself.
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" \
  --allow-unauthenticated --memory 1Gi --timeout 300 --max-instances 5 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT,BIRDBRAINS_BUCKET=$BUCKET,BIRDBRAINS_CORS_ORIGINS=$ORIGIN" \
  --set-secrets "BIRDBRAINS_BATCH_TOKEN=birdbrains-batch-token:latest"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"

echo "== Nightly worksheet jobs (Cloud Scheduler)"
TOKEN="$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
schedule() {  # name, cron, path
  local verb=create
  gcloud scheduler jobs describe "$1" --location "$REGION" >/dev/null 2>&1 && verb=update
  gcloud scheduler jobs $verb http "$1" --location "$REGION" --schedule "$2" --time-zone "America/Toronto" \
    --uri "$URL$3" --http-method POST --update-headers "X-Batch-Token=$TOKEN" >/dev/null
}
schedule birdbrains-worksheets-submit  "0 1 * * *"     /internal/batch/worksheets/submit
schedule birdbrains-worksheets-collect "*/30 2-8 * * *" /internal/batch/worksheets/collect

echo
echo "API is live at: $URL"
echo "Set NEXT_PUBLIC_API_URL=$URL in Netlify, then finish the Firebase steps in backend/README.md."
