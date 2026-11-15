"""Email delivery and scheduled, idempotent medication/appointment checks."""
from __future__ import annotations
import json
import os
import smtplib
import ssl
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from urllib import request
from urllib.error import HTTPError
from zoneinfo import ZoneInfo


def utcnow():
    return datetime.now(timezone.utc)


def stamp():
    return utcnow().isoformat()


def email_delivery(to_address: str, subject: str, body: str) -> str:
    """Returns 'sent' or 'demo' or raises; configured providers never silently fall back."""
    sendgrid = os.getenv('SENDGRID_API_KEY')
    smtp_host = os.getenv('SMTP_HOST')
    sender = os.getenv('MAIL_FROM','CareCircle <notifications@example.com>')
    if sendgrid:
        payload={'personalizations':[{'to':[{'email':to_address}]}], 'from':{'email':os.getenv('MAIL_FROM_EMAIL','notifications@example.com'),'name':'CareCircle'},'subject':subject,'content':[{'type':'text/plain','value':body}]}
        req=request.Request('https://api.sendgrid.com/v3/mail/send',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+sendgrid,'Content-Type':'application/json'},method='POST')
        with request.urlopen(req,timeout=10) as r:
            if r.status not in (200,202):
                raise RuntimeError('Unexpected email provider response')
        return 'sent'
    if smtp_host:
        msg=EmailMessage()
        msg['To'], msg['From'], msg['Subject']=to_address,sender,subject
        msg.set_content(body)
        port=int(os.getenv('SMTP_PORT','587'))
        with smtplib.SMTP(smtp_host,port,timeout=12) as server:
            server.starttls(context=ssl.create_default_context())
            if os.getenv('SMTP_USER'):
                server.login(os.getenv('SMTP_USER'),os.getenv('SMTP_PASSWORD',''))
            server.send_message(msg)
        return 'sent'
    return 'demo'


def send_unique(store, key: str, patient_id: str, recipients: list[str], title: str, body: str, kind: str, now: datetime):
    """Claim first, then deliver; retry failures on the next scan; never duplicate successes.

    Note: cross-worker race for a failed record is still possible; use a queue / lease for scale.
    """
    recipients=sorted(set(r.strip().lower() for r in recipients if r and '@' in r))
    if not recipients:
        return 0
    delivered=0
    for email in recipients:
        rec_key=key+':'+email
        existing=store.get('alerts',rec_key)
        if existing and existing.get('state') in ('sent','demo'):
            continue
        payload={'id':rec_key,'patient_id':patient_id,'email':email,'title':title,'kind':kind,'body':body,'state':'processing','at':now.isoformat()}
        if existing:
            # Retry failed sends. Production scale should use a task queue to lease retries.
            if existing.get('state')!='failed':
                continue
            store.put('alerts',rec_key,payload)
        elif not store.create('alerts',rec_key,payload):
            continue
        try:
            payload['state']=email_delivery(email,title,body)
        except Exception:
            payload['state']='failed'
        store.put('alerts',rec_key,payload)
        delivered+=1
    return delivered


def run_checks(store, now: datetime | None = None):
    now=(now or utcnow()).astimezone(timezone.utc)
    scans=0
    created=0
    for patient in store.find('patients'):
        pid=patient['id']
        tz=ZoneInfo(patient.get('timezone','Asia/Kolkata'))
        local=now.astimezone(tz)
        grace=int(patient.get('grace_minutes',30))
        before=int(patient.get('reminder_minutes',15))
        owner=store.get('users',patient['owner_id'])
        owner_email=owner['email'] if owner else ''
        family_emails=[]
        if patient.get('notify_caregivers',True):
            for member in store.find('members','patient_id',pid):
                if member.get('user_id') != patient['owner_id'] and member.get('notify',True):
                    user=store.get('users',member['user_id'])
                    if user:
                        family_emails.append(user['email'])
        for med in store.find('medications','patient_id',pid):
            if not med.get('active',True):
                continue
            for day in (local.date()-timedelta(days=1), local.date(),local.date()+timedelta(days=1)):
                if day.isoformat() < med.get('effective_from',local.date().isoformat()):
                    continue
                for hhmm in med.get('times',[]):
                    try:
                        hour,minute=map(int,hhmm.split(':'))
                        due=datetime(day.year,day.month,day.day,hour,minute,tzinfo=tz).astimezone(timezone.utc)
                    except (ValueError,TypeError):
                        continue
                    diff=(due-now).total_seconds()/60
                    scans+=1
                    dose_id=f"{med['id']}:{day.isoformat()}:{hhmm}"
                    record=store.get('doses',dose_id)
                    if record and record.get('status') in ('taken','skipped'):
                        continue
                    label=f"{med['name']} ({med.get('dosage','dose')})"
                    if 0<=diff<=before:
                        created+=send_unique(store,'upcoming:'+dose_id,pid,[owner_email],f'Time for {med["name"]} soon',f'Hello {patient["name"]},\n\nYour scheduled medication {label} is due at {hhmm} ({patient.get("timezone","Asia/Kolkata")}).\n\nPlease confirm in CareCircle only after taking it. Follow your clinician’s instructions.', 'medication',now)
                    if -48*60<=diff<=-grace:
                        created+=send_unique(store,'missed:'+dose_id,pid,family_emails,f'Medication needs a check-in: {med["name"]}',f'{patient["name"]} has not confirmed {label} scheduled for {day.isoformat()} at {hhmm}.\n\nPlease check in with them. An unconfirmed dose does not necessarily mean it was missed. Do not double doses without clinical guidance.', 'unconfirmed',now)
        for appt in store.find('appointments','patient_id',pid):
            if appt.get('cancelled'):
                continue
            try:
                due=datetime.fromisoformat(appt['at']).replace(tzinfo=tz).astimezone(timezone.utc)
            except (ValueError,KeyError):
                continue
            mins=(due-now).total_seconds()/60
            for cutoff,window,tag in ((1440,10,'24h'),(60,10,'1h')):
                if cutoff-window<=mins<=cutoff:
                    recipients=[owner_email]+family_emails
                    created+=send_unique(store,f'appointment:{tag}:{appt["id"]}',pid,recipients,f'Appointment reminder: {appt["title"]}',f'{patient["name"]} has an upcoming appointment: {appt["title"]}, at {appt["at"]} ({patient.get("timezone","Asia/Kolkata")}).\nLocation: {appt.get("location") or "Not specified"}\n\nPlease confirm the appointment details with the provider.','appointment',now)
    return {'checked_schedules':scans,'alert_attempts':created,'at':now.isoformat()}
