#!/usr/bin/env bash
# Deploy the BirdBrains API to Cloud Run in Montréal.
#
#   ./deploy.sh <gcp-project-id> [frontend-origin]
#
# Needs the gcloud CLI, signed in as a project owner, with billing enabled on the
# project. Safe to run again: existing resources are left alone.
set -euo pipefail

PROJECT="${1:?usage: ./deploy.sh <gcp-project-id> [frontend-origin]}"
# The site lives in its own Firebase project (boson-quark) at the custom domain quark.study;
# the API, Firestore and sign-in stay here.
ORIGIN="${2:-https://quark.study}"
# Also allowed: www.quark.study (redirects to quark.study), the boson-quark Firebase addresses and the
# first address (<project>.web.app), all still served.
CORS="$ORIGIN,https://quark.study,https://www.quark.study,https://boson-quark.web.app,https://boson-quark.firebaseapp.com,https://boson-planck.web.app,https://boson-planck.firebaseapp.com,https://${PROJECT}.web.app,https://${PROJECT}.firebaseapp.com"
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
  compute.googleapis.com dlp.googleapis.com classroom.googleapis.com drive.googleapis.com

echo "== Storage bucket and Firestore (both in $REGION)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
# Raw photos are deleted 90 days after upload (spec 3.2).
LIFECYCLE="$(mktemp)"
cat > "$LIFECYCLE" <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 90, "matchesPrefix": ["submissions/"]}}]}
JSON
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file="$LIFECYCLE" >/dev/null
rm -f "$LIFECYCLE"
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 || \
  gcloud firestore databases create --database="(default)" --location="$REGION" --type=firestore-native

echo "== Service account"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create birdbrains-api --display-name="BirdBrains API"
# firebaseauth.admin: look up accounts by email (testing accounts) and delete them (delete my data).
for role in roles/aiplatform.user roles/datastore.user roles/dlp.user roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" \
    --condition=None >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" \
  --role=roles/storage.objectAdmin >/dev/null
# Nightly worksheet batch jobs run as Vertex AI's own service agent, which reads the
# request file from the bucket and writes the results back to it.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud beta services identity create --service=aiplatform.googleapis.com --project "$PROJECT" >/dev/null 2>&1 || true
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-aiplatform.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin >/dev/null

echo "== Batch token (Secret Manager)"
if ! gcloud secrets describe birdbrains-batch-token >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create birdbrains-batch-token --data-file=- \
    --replication-policy=user-managed --locations="$REGION"
fi
gcloud secrets add-iam-policy-binding birdbrains-batch-token --member="serviceAccount:$SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null

echo "== Optional secrets (Stripe, Google Classroom)"
# Each is wired in only if it exists in Secret Manager. Create one with:
#   printf '%s' 'VALUE' | gcloud secrets create NAME --data-file=- \
#     --replication-policy=user-managed --locations=northamerica-northeast1
SECRETS="BIRDBRAINS_BATCH_TOKEN=birdbrains-batch-token:latest"
optional_secret() {  # ENV_NAME secret-name
  if gcloud secrets describe "$2" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "$2" --member="serviceAccount:$SA" \
      --role=roles/secretmanager.secretAccessor >/dev/null
    SECRETS="$SECRETS,$1=$2:latest"
    echo "   $2: found"
  else
    echo "   $2: not set (feature stays off)"
  fi
}
optional_secret STRIPE_SECRET_KEY          birdbrains-stripe-secret-key
optional_secret STRIPE_WEBHOOK_SECRET      birdbrains-stripe-webhook-secret
optional_secret STRIPE_PRICE_ID            birdbrains-stripe-price-id
optional_secret STRIPE_PORTAL_CONFIGURATION birdbrains-stripe-portal-config
optional_secret GOOGLE_OAUTH_CLIENT_ID      birdbrains-google-oauth-client-id
optional_secret GOOGLE_OAUTH_CLIENT_SECRET  birdbrains-google-oauth-client-secret
# Canvas and Brightspace keys belong to each school (tools/lms_schools.py stores
# them, sealed with this key). Made once here; never rotate it without re-adding
# every school, or their stored keys and teachers' tokens can't be read.
if ! gcloud secrets describe birdbrains-lms-token-key >/dev/null 2>&1; then
  openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | \
    gcloud secrets create birdbrains-lms-token-key --data-file=- \
      --replication-policy=user-managed --locations="$REGION"
fi
optional_secret BIRDBRAINS_LMS_KEY              birdbrains-lms-token-key
optional_secret MICROSOFT_OAUTH_CLIENT_ID       birdbrains-microsoft-oauth-client-id
optional_secret MICROSOFT_OAUTH_CLIENT_SECRET   birdbrains-microsoft-oauth-client-secret
# Read key for the growth dashboard in Planck (GET /internal/attribution). Made once
# here; paste it into Planck's growth page with
#   gcloud secrets versions access latest --secret=quark-growth-key
if ! gcloud secrets describe quark-growth-key >/dev/null 2>&1; then
  openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | \
    gcloud secrets create quark-growth-key --data-file=- \
      --replication-policy=user-managed --locations="$REGION"
fi
optional_secret QUARK_GROWTH_KEY                quark-growth-key

echo "== Build permissions"
# New projects build source deploys as the default compute service account, which
# starts without build rights. Grant them, then give IAM a minute to propagate.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/run.builder --condition=None >/dev/null
sleep 60

echo "== Deploying to Cloud Run"
# Model and region overrides: export them before running, for example
#   BIRDBRAINS_VERTEX_LOCATION=northamerica-northeast2 BIRDBRAINS_STAGE1_MODEL=gemini-3.5-flash ./deploy.sh <project>
# (python tools/check_models.py shows which models each Canadian region serves.)
EXTRA=""
for v in BIRDBRAINS_VERTEX_LOCATION BIRDBRAINS_STAGE1_MODEL BIRDBRAINS_STAGE2_MODEL BIRDBRAINS_STAGE2_FREE_MODEL BIRDBRAINS_WORKSHEET_MODEL; do
  [ -n "${!v:-}" ] && EXTRA="$EXTRA;$v=${!v}"
done
# --allow-unauthenticated: the browser calls the API directly; every route except
# /health checks a Firebase sign-in token (or the batch token) itself.
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" \
  --allow-unauthenticated --memory 1Gi --timeout 300 --max-instances 5 \
  --set-env-vars "^;^GOOGLE_CLOUD_PROJECT=$PROJECT;BIRDBRAINS_BUCKET=$BUCKET;BIRDBRAINS_CORS_ORIGINS=$CORS;BIRDBRAINS_SITE_URL=$ORIGIN;XDG_CACHE_HOME=/tmp$EXTRA" \
  --set-secrets "$SECRETS"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
# The API needs its own public address for the Google sign-in return link.
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "BIRDBRAINS_PUBLIC_URL=$URL" >/dev/null

echo "== Nightly worksheet jobs (Cloud Scheduler)"
TOKEN="$(gcloud secrets versions access latest --secret=birdbrains-batch-token)"
schedule() {  # name, cron, path
  # create takes --headers; update takes --update-headers
  local verb=create headers=--headers
  gcloud scheduler jobs describe "$1" --location "$REGION" >/dev/null 2>&1 && verb=update headers=--update-headers
  gcloud scheduler jobs $verb http "$1" --location "$REGION" --schedule "$2" --time-zone "America/Toronto" \
    --uri "$URL$3" --http-method POST "$headers" "X-Batch-Token=$TOKEN" >/dev/null
}
schedule birdbrains-worksheets-submit  "0 1 * * *"     /internal/batch/worksheets/submit
schedule birdbrains-worksheets-collect "*/30 * * * *"    /internal/batch/worksheets/collect

echo
echo "API is live at: $URL"
echo "Stripe webhook endpoint:        $URL/billing/webhook"
echo "Google OAuth redirect URI:      $URL/classroom/callback"
echo "Publish the site with ../deploy-web.sh $PROJECT (it reads this URL itself)."
