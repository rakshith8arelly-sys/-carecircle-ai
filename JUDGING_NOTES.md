# How CareCircle maps to the hackathon's evaluation categories

| Criterion | Evidence in code / demo |
|---|---|
| Problem statement alignment | Profile, medications, appointments, adherence, reminders, authorized family/caregiver access: `app/main.py`, `app/alerts.py` |
| Code quality | Typed request models and separate storage, security, alert modules; clearly scoped APIs; tests under `tests/` |
| Security | scrypt password hashes, signed expiring tokens, one-use hashed invite codes, per-profile RBAC, access revocation, audit log, Secret Manager deployment |
| Efficiency | Five-minute scheduled checks, recipient-level idempotency, Firestore queries filtered per patient; work still needed for large-scale queues |
| Testing | Integration test of owner/viewer/outsider permissions, invite re-use, dose validation, ownership transfers, reminder deduplication |
| Accessibility | Large-text toggle, mobile responsive controls, alt/aria labels, visible keyboard focus, browser voice synthesis, reduced-motion support |
| Innovation | Explicitly consented ownership transfer, stepped caregiver escalation without false medical certainty, rule-based progress insights, shared decision-making |

**Be transparent during the demo:** Email is only delivered with verified SendGrid/SMTP and an operational Scheduler; otherwise alerts are saved as `demo`. CareCircle is an MVP and not clinically validated. The care insights are rule-based, not a generative AI model.
