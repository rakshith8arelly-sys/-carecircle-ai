# CareCircle AI — Hack2Skill submission checklist

## Before publishing

- [ ] Run `python -m pip install -r requirements.txt` and `python -m pytest -q`.
- [ ] Confirm `python -m uvicorn app.main:app --reload` starts and that `http://127.0.0.1:8000` loads.
- [ ] Do **not** publish `.env`, API keys, login tokens, real patient records, or cloud account credentials.
- [ ] The demo login is public for judges. Keep it on fictional sample data only.

## Public GitHub repository

1. Create a public empty repository on https://github.com/new named `carecircle-ai`.
2. Open PowerShell **in the extracted `carecircle-ai` directory**.
3. Run:

   ```powershell
   git init
   git add .
   git commit -m "Initial CareCircle AI hackathon submission"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/carecircle-ai.git
   git push -u origin main
   ```

4. Replace `YOUR-USERNAME` with your actual GitHub username. Authorize GitHub through its secure sign-in screen; do not paste passwords in chats.
5. Confirm the repository opens publicly and copy its true HTTPS address.

## Google Cloud Run

1. Sign in to Google Cloud yourself at https://console.cloud.google.com/ and select or create a billing-enabled Google Cloud project.
2. Open Cloud Shell and upload the extracted project's ZIP contents, or clone your published GitHub repository into Cloud Shell.
3. Run from the project directory in Cloud Shell:

   ```bash
   export PROJECT_ID="REPLACE_WITH_ACTUAL_PROJECT_ID"
   export REGION="asia-south1"
   export DEMO_MODE=1
   bash scripts/deploy_cloud_run.sh
   ```

4. Follow the on-screen Google authorization/IAM prompts. The script may create paid resources (Cloud Run, Firestore, Scheduler, etc.).
5. Copy the actual Cloud Run HTTPS URL printed by the deployment script. Test the `/api/health` endpoint and demo login.
6. Email stays simulated without SendGrid or SMTP setup; see `DEPLOY.md` if judge requires actual email delivery.

## LinkedIn

1. Review and publish `LINKEDIN_POST.md` from your own LinkedIn account.
2. Include the **real** GitHub and Cloud Run URLs, and do not claim features that the app does not implement.
3. Use the LinkedIn post's Share menu to copy its direct link (not your profile URL).

## Hack2Skill submission form

- Challenge: Elderly Care & Medication Management Platform
- Public GitHub Repository Link: your verified `https://github.com/.../carecircle-ai` repository
- Deployed Link (Cloud run URL): your actual `https://...run.app` service URL
- LinkedIn Post: the actual `https://www.linkedin.com/posts/...` link

**Never share passwords, OTPs, recovery codes, cloud service-account private keys, or API tokens in chat.** Use the providers' official sign-in and account permission flows.
