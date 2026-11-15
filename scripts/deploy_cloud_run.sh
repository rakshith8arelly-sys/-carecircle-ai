#!/usr/bin/env bash
# Execute inside the extracted project folder in Google Cloud Shell.
set -euo pipefail
: "${PROJECT_ID:?Run: export PROJECT_ID=your-google-cloud-project-id}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-carecircle-ai}"
DEMO_MODE="${DEMO_MODE:-1}" # Synthetic account only; NEVER add real patients to public demo.
SA_NAME='carecircle-runtime'
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
export APP_SECRET="${APP_SECRET:-$(openssl rand -hex 32)}"
export SCHEDULER_SECRET="${SCHEDULER_SECRET:-$(openssl rand -hex 32)}"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com

if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native
fi
if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name='CareCircle runtime'
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" --role='roles/datastore.user' --quiet >/dev/null

upsert_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic >/dev/null
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$SA" \
    --role='roles/secretmanager.secretAccessor' --quiet >/dev/null
}
upsert_secret 'carecircle-app-secret' "$APP_SECRET"
upsert_secret 'carecircle-scheduler-secret' "$SCHEDULER_SECRET"

gcloud run deploy "$SERVICE" --source . --region="$REGION" \
  --service-account="$SA" --allow-unauthenticated --memory=512Mi --timeout=30 \
  --set-env-vars="APP_ENV=production,DATA_BACKEND=firestore,DEMO_MODE=$DEMO_MODE" \
  --set-secrets='APP_SECRET=carecircle-app-secret:latest,SCHEDULER_SECRET=carecircle-scheduler-secret:latest'

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
if gcloud scheduler jobs describe "${SERVICE}-reminders" --location="$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${SERVICE}-reminders" --location="$REGION" \
    --schedule='*/5 * * * *' --time-zone='UTC' --http-method='POST' \
    --uri="${URL}/api/scheduler/run" --headers="X-Scheduler-Key=$SCHEDULER_SECRET"
else
  gcloud scheduler jobs create http "${SERVICE}-reminders" --location="$REGION" \
    --schedule='*/5 * * * *' --time-zone='UTC' --http-method='POST' \
    --uri="${URL}/api/scheduler/run" --headers="X-Scheduler-Key=$SCHEDULER_SECRET"
fi
printf '\nCareCircle deployed!\nCloud Run URL: %s\nHealth check: %s/api/health\n' "$URL" "$URL"
printf '\nEmail mode remains demo until SENDGRID_API_KEY or SMTP is configured.\n'
printf 'Do not use real patient information in public DEMO_MODE.\n'
