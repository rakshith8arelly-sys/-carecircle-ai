# Deploy CareCircle to Google Cloud Run

These steps use your **own Google Cloud account/project**, Google Cloud Shell and a billing-enabled project. Cloud Run, Firestore, Cloud Scheduler, Secret Manager, Cloud Build and an email provider may incur charges. Do not upload real patient data to a public hackathon demo.

## 1. Upload source to Google Cloud Shell

Download `carecircle-ai.zip`, unzip it on your computer, then upload its contents to [Google Cloud Shell](https://shell.cloud.google.com/) or commit them to your GitHub repository and clone there:

```bash
# From inside the carecircle-ai folder:
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
gcloud auth login
gcloud config set project "$PROJECT_ID"
```

## 2. One-command deployment script

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
export DEMO_MODE=1  # public judges' demo with fictional Meera Sharma data
bash scripts/deploy_cloud_run.sh
```

The script:

- Enables Google Cloud APIs, creates a Firestore Native mode database if one doesn't exist, creates a least-privilege runtime service account, and grants its Firestore user role.
- Generates two random secrets and stores them in **Google Secret Manager**, granting access only to the runtime service account.
- Deploys the app source via Dockerfile (`gcloud run deploy --source .`).
- Creates or updates an authenticated-by-header Cloud Scheduler job invoking the reminder endpoint every 5 minutes.
- Prints **your actual** `https://...run.app` URL after success. Use that exact URL in the Hack2Skill **Deployed Link (Cloud run URL)** box.

If you prefer a private demo, use `export DEMO_MODE=0`; create an account and profile at the deployed URL. This sample requires an authorized login for any patient data, even when the web page itself is publicly reachable.

**Important:** The scheduler header secret is stored in the Cloud Scheduler job configuration and is visible to project administrators. For production, replace it with a platform-native OIDC / IAM integration or a dedicated private service.

## 3. Turn on actual email delivery (optional but important for the challenge)

By default the app records **demo** notifications and does not send email. Get a **verified sender** and API key from SendGrid, then add an extra secret to the project:

```bash
# Type your private SendGrid API key; don't commit it to GitHub.
read -rs SENDGRID_API_KEY
printf '%s' "$SENDGRID_API_KEY" | gcloud secrets create carecircle-sendgrid \
  --replication-policy=automatic --data-file=-

SA="carecircle-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding carecircle-sendgrid \
  --member="serviceAccount:$SA" --role='roles/secretmanager.secretAccessor'

# IMPORTANT: --update-secrets preserves the existing app/scheduler secrets.
gcloud run services update carecircle-ai --region="$REGION" \
  --update-secrets='SENDGRID_API_KEY=carecircle-sendgrid:latest' \
  --update-env-vars='MAIL_FROM_EMAIL=verified-sender@yourdomain.com'
```

Replace `verified-sender@yourdomain.com` with your **actual verified SendGrid sender**. Run a scheduler job after configuring it; the Activity page records delivery attempts. SendGrid can accept an email while delivery to an inbox still fails due to spam/bounces; check its activity dashboard.

**Alternative: SMTP** is supported with environment variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`; prefer Secret Manager for passwords. Do not embed any email credentials into source or frontend files.

## 4. Get all three required hackathon links

**Public GitHub Repository Link:** Create a public repo at [GitHub](https://github.com/new), e.g. `carecircle-ai`. In the extracted project directory:

```bash
git init
git add .
git commit -m "Build CareCircle elderly care platform"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/carecircle-ai.git
git push -u origin main
```

Use your *real* username, complete GitHub authorization, and paste that new public repo URL into the submission form.

**Deployed Link (Cloud run URL):** After deploy, retrieve it again using:

```bash
gcloud run services describe carecircle-ai \
  --region="$REGION" --format='value(status.url)'
```

Paste the resulting HTTPS address, not a guessed URL.

**LinkedIn Post:** Publish the short post in `LINKEDIN_POST.md` with your real repo and Cloud Run URLs, select **Copy link to post** in LinkedIn, and paste that post's `https://www.linkedin.com/posts/...` address into the form. A profile URL is not the same as your published project post.

## 5. Quick verification

- Open `https://YOUR-RUN-URL.run.app/api/health`: expect `{"status":"ok","app":"CareCircle AI","backend":"firestore"}`.
- Open the site and sign in to the synthetic demo.
- Create a medication and mark a dose taken. Refresh the browser: Firestore should preserve the change.
- Show an authorized second account joining via invite and read-only permissions.
- Verify Scheduler is enabled and, with email configured, check a reminder in Activity.

### Troubleshooting

- **403 Firestore**: verify Cloud Run service account has `roles/datastore.user` and the Firestore Native database exists.
- **App fails startup**: `APP_ENV=production` requires a nondefault `APP_SECRET` of at least 32 characters; verify secret mounting permissions.
- **No real email**: configure verified SendGrid credentials and check the Scheduler job. Demo status explicitly means no external delivery.
- **No cloud URL**: deployment has not succeeded; fix billing, IAM, Cloud Build or region issues before submitting.

Official docs: [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code) · [Firestore locations](https://docs.cloud.google.com/firestore/native/docs/locations) · [Cloud Scheduler](https://cloud.google.com/scheduler/docs).
