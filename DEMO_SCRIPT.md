# 90-second judges' demo — CareCircle

**Opening (10s):** “Many elderly people have to manage medication routines, appointments, and care conversations across different family members. CareCircle brings that into one shared, accessible space without taking away the elderly person's control.”

**Dashboard (20s):** Sign in using **Try demo account**. Point to the daily medication plan, upcoming appointment, seven-day chart and insight. Press **Read my day** for the spoken care briefing. Mention the large-text **Aa** toggle.

**Medication workflow (20s):** Open Medications. Add a fictional daily medicine with two times. Mark one as taken. The dashboard updates. Explain unconfirmed-dose escalation: before the dose, email the owner; after a configurable grace period, alert opted-in family members — but do not presume the dose was medically missed.

**Connected caregivers (20s):** Open Care circle. Invite a viewer using a one-time code. Explain owner/family/caregiver/viewer access restrictions and caregiver invitations. Show that ownership transfer requires the new owner to accept, allowing an elderly member to take control.

**Alerts & architecture (15s):** Open Activity and press **Preview alert** (demo mode). Explain the real pipeline: Cloud Scheduler → FastAPI → Firestore → SendGrid; all recipient deliveries are deduplicated and logged. Say explicitly that preview notifications are not actual outgoing emails until a provider is configured.

**Close (5s):** “Our idea isn't to replace the older adult's choices. It's to make healthcare routines easier, auditable, and shared only with trusted people.”

**Never claim:** Live emails have been delivered when mail mode says Demo. The project has generative AI, OCR, regulated medical compliance, or guaranteed prevention of missed medication.
