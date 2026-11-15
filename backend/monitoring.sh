#!/usr/bin/env bash
# Monitoring for the BirdBrains API: uptime check, cost and speed metrics, alerts
# and a dashboard. Run after deploy.sh, in Cloud Shell:
#
#   ./monitoring.sh <gcp-project-id> <alert-email>
#
# Safe to run again. Each step is independent: if one fails it prints a warning
# and the rest still run.
set -uo pipefail

PROJECT="${1:?usage: ./monitoring.sh <gcp-project-id> <alert-email>}"
EMAIL="${2:?usage: ./monitoring.sh <gcp-project-id> <alert-email>}"
REGION="northamerica-northeast1"
SERVICE="birdbrains-api"
HOURLY_USD_ALERT="${HOURLY_USD_ALERT:-2}"   # model spend in one hour, per plan
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
warn() { echo "   WARNING: $1 (skipped; the other steps continue)"; }

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable monitoring.googleapis.com logging.googleapis.com >/dev/null
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
HOST="${URL#https://}"
[ -n "$HOST" ] || { echo "Cloud Run service $SERVICE not found. Run deploy.sh first."; exit 1; }

echo "== Log-based metrics (from the pipeline_done line the API prints per graded upload)"
metric() {  # name, field, unit, description
  cat > "$TMP/$1.yaml" <<YAML
description: "$4"
filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="$SERVICE" AND jsonPayload.event="pipeline_done"'
valueExtractor: 'EXTRACT(jsonPayload.$2)'
labelExtractors:
  plan: 'EXTRACT(jsonPayload.plan)'
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: "$3"
  labels:
    - key: plan
      valueType: STRING
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 64
    growthFactor: 1.3
    scale: 0.0001
YAML
  if gcloud logging metrics describe "$1" >/dev/null 2>&1; then
    gcloud logging metrics update "$1" --config-from-file="$TMP/$1.yaml" >/dev/null || warn "metric $1"
  else
    gcloud logging metrics create "$1" --config-from-file="$TMP/$1.yaml" >/dev/null || warn "metric $1"
  fi
}
metric birdbrains_upload_usd     usd     "USD" "Model cost per graded upload, by plan"
metric birdbrains_upload_seconds seconds "s"   "Model time per graded upload, by plan"

echo "== Uptime check on /health (every 5 minutes)"
if ! gcloud monitoring uptime list-configs --format='value(displayName)' 2>/dev/null | grep -qx "birdbrains-health"; then
  gcloud monitoring uptime create birdbrains-health --resource-type=uptime-url \
    --resource-labels="host=$HOST,project_id=$PROJECT" --protocol=https --path=/health \
    --period=5 --timeout=10 >/dev/null || warn "uptime check"
fi

echo "== Alert email"
CHANNEL="$(gcloud beta monitoring channels list --filter="type=email AND labels.email_address=$EMAIL" \
  --format='value(name)' 2>/dev/null | head -n1)"
if [ -z "$CHANNEL" ]; then
  CHANNEL="$(gcloud beta monitoring channels create --display-name="BirdBrains alerts" --type=email \
    --channel-labels="email_address=$EMAIL" --format='value(name)')" || warn "alert email"
fi

echo "== Alerts"
policy() {  # display name, condition JSON
  if gcloud alpha monitoring policies list --format='value(displayName)' 2>/dev/null | grep -qx "$1"; then
    echo "   $1: already exists"
    return
  fi
  cat > "$TMP/policy.json" <<JSON
{"displayName": "$1", "combiner": "OR", "enabled": true, "conditions": [$2]}
JSON
  gcloud alpha monitoring policies create --policy-from-file="$TMP/policy.json" \
    ${CHANNEL:+--notification-channels="$CHANNEL"} >/dev/null && echo "   $1: created" || warn "alert '$1'"
}
RUN='resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"'"$SERVICE"'\"'

policy "BirdBrains: API is down" '{
  "displayName": "Health check failing from 2 or more locations",
  "conditionThreshold": {
    "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND resource.labels.host=\"'"$HOST"'\"",
    "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_NEXT_OLDER",
                      "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.host"]}],
    "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "300s"}}'

policy "BirdBrains: server errors" '{
  "displayName": "More than 5 server errors in 5 minutes",
  "conditionThreshold": {
    "filter": "metric.type=\"run.googleapis.com/request_count\" AND '"$RUN"' AND metric.labels.response_code_class=\"5xx\"",
    "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_SUM", "crossSeriesReducer": "REDUCE_SUM"}],
    "comparison": "COMPARISON_GT", "thresholdValue": 5, "duration": "0s"}}'

policy "BirdBrains: diagnostics are slow" '{
  "displayName": "P95 model time over 14 s for 15 minutes",
  "conditionThreshold": {
    "filter": "metric.type=\"logging.googleapis.com/user/birdbrains_upload_seconds\" AND resource.type=\"cloud_run_revision\"",
    "aggregations": [{"alignmentPeriod": "900s", "perSeriesAligner": "ALIGN_PERCENTILE_95", "crossSeriesReducer": "REDUCE_MAX"}],
    "comparison": "COMPARISON_GT", "thresholdValue": 14, "duration": "0s"}}'

policy "BirdBrains: model spend is high" '{
  "displayName": "Model spend over $'"$HOURLY_USD_ALERT"' in one hour on one plan",
  "conditionThreshold": {
    "filter": "metric.type=\"logging.googleapis.com/user/birdbrains_upload_usd\" AND resource.type=\"cloud_run_revision\"",
    "aggregations": [{"alignmentPeriod": "3600s", "perSeriesAligner": "ALIGN_SUM", "crossSeriesReducer": "REDUCE_SUM",
                      "groupByFields": ["metric.label.plan"]}],
    "comparison": "COMPARISON_GT", "thresholdValue": '"$HOURLY_USD_ALERT"', "duration": "0s"}}'

echo "== Dashboard"
chart() {  # title, metric filter, aligner, reducer, group-by JSON, period
  cat <<JSON
{"title": "$1", "xyChart": {"dataSets": [{"plotType": "LINE", "timeSeriesQuery": {"timeSeriesFilter": {
  "filter": "$2",
  "aggregation": {"alignmentPeriod": "$6", "perSeriesAligner": "$3", "crossSeriesReducer": "$4", "groupByFields": $5}}}}]}}
JSON
}
COST='metric.type=\"logging.googleapis.com/user/birdbrains_upload_usd\" AND resource.type=\"cloud_run_revision\"'
SECS='metric.type=\"logging.googleapis.com/user/birdbrains_upload_seconds\" AND resource.type=\"cloud_run_revision\"'
REQ='metric.type=\"run.googleapis.com/request_count\" AND '"$RUN"
LAT='metric.type=\"run.googleapis.com/request_latencies\" AND '"$RUN"
PLAN='["metric.label.plan"]'
cat > "$TMP/dashboard.json" <<JSON
{"displayName": "BirdBrains", "gridLayout": {"columns": "2", "widgets": [
$(chart "Model cost per day, by plan (USD)" "$COST" ALIGN_SUM REDUCE_SUM "$PLAN" 86400s),
$(chart "Cost per upload, by plan (USD, hourly mean)" "$COST" ALIGN_MEAN REDUCE_MEAN "$PLAN" 3600s),
$(chart "Model time per upload, P95 by plan (s)" "$SECS" ALIGN_PERCENTILE_95 REDUCE_MAX "$PLAN" 900s),
$(chart "Requests per minute, by response class" "$REQ" ALIGN_RATE REDUCE_SUM '["metric.label.response_code_class"]' 60s),
$(chart "Request time, P95 (ms)" "$LAT" ALIGN_PERCENTILE_95 REDUCE_MAX '[]' 300s)
]}}
JSON
if gcloud monitoring dashboards list --format='value(displayName)' 2>/dev/null | grep -qx "BirdBrains"; then
  echo "   dashboard already exists"
else
  python3 -m json.tool "$TMP/dashboard.json" >/dev/null && gcloud monitoring dashboards create --config-from-file="$TMP/dashboard.json" >/dev/null || warn "dashboard"
fi

echo
echo "Done. Dashboard: https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT"
echo "Alerts go to $EMAIL. Google sends that address a confirmation link the first time."
echo "Total spend is covered separately by the billing budget alert (Billing > Budgets)."
