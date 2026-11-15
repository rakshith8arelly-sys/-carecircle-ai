"""CareCircle AI — working elderly-first care coordination MVP."""
from __future__ import annotations
import hashlib
import hmac
import os
import re
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .alerts import run_checks, stamp, utcnow
from .security import LoginLimiter, code_digest, hash_password, new_invite, sign_token, verify_token, verify_password
from .store import make_store

APP_ENV=os.getenv('APP_ENV','development')
SECRET=os.getenv('APP_SECRET','local-development-only-change-this-secret')
if APP_ENV=='production' and (len(SECRET)<32 or SECRET=='local-development-only-change-this-secret'):
    raise RuntimeError('Set APP_SECRET to a unique 32+ character random value in production')

store=make_store()
limiter=LoginLimiter()
app=FastAPI(title='CareCircle AI', version='1.0.0', docs_url='/api/docs' if APP_ENV!='production' else None, redoc_url=None)
STATIC=Path(__file__).parent/'static'
app.mount('/static',StaticFiles(directory=str(STATIC)), name='static')


def uid(): return uuid.uuid4().hex

def fail(message, code=400): raise HTTPException(code, detail=message)


def clean_email(email):
    email=email.strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:
        fail('Enter a valid email address')
    return email


def must_timezone(s):
    try: ZoneInfo(s)
    except (ZoneInfoNotFoundError,KeyError,ValueError): fail('Unknown timezone')
    return s


def valid_times(times):
    if not times or len(times)>12 or len(times)!=len(set(times)):
        fail('Enter 1–12 unique daily times')
    if not all(re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',v) for v in times):
        fail('Use HH:MM time, e.g. 08:30')
    return sorted(times)


def valid_appt(when):
    try:
        dt=datetime.fromisoformat(when)
        if dt.tzinfo is not None or len(when)<16: raise ValueError()
    except (ValueError,TypeError): fail('Enter local date and time, e.g. 2026-11-16T10:30')
    return when[:16]


def safe_user(user):
    return {'id':user['id'],'name':user['name'],'email':user['email']}


def current_user(authorization: str | None = Header(None)):
    if not authorization or not authorization.lower().startswith('bearer '):
        fail('Please sign in',401)
    user_id=verify_token(authorization[7:],SECRET)
    if not user_id: fail('Session expired. Please sign in again',401)
    user=store.get('users',user_id)
    if not user: fail('Account not found',401)
    return user


def require_member(patient_id, user, edit=False, owner=False):
    patient=store.get('patients',patient_id)
    if not patient: fail('Patient profile not found',404)
    m=store.get('members',f'{patient_id}_{user["id"]}')
    if not m: fail('You do not have access to this profile',403)
    if owner and m['role']!='owner': fail('Only the profile owner can manage access and settings',403)
    if edit and m['role'] not in ('owner','family','caregiver'): fail('Read-only access',403)
    return patient,m


def audit(pid, user_id, action, detail=''):
    key=uid()
    store.put('audit',key,{'id':key,'patient_id':pid,'user_id':user_id,'action':action,'detail':detail[:140],'at':stamp()})


class Signup(BaseModel):
    name: str = Field(min_length=2,max_length=80)
    email: str = Field(min_length=5,max_length=254)
    password: str = Field(min_length=10,max_length=128)

class Login(BaseModel):
    email: str
    password: str

class PatientInput(BaseModel):
    name: str = Field(min_length=2,max_length=80)
    age: int = Field(ge=1,le=120)
    timezone: str = 'Asia/Kolkata'
    emergency_contact: str = Field(default='',max_length=120)

class SettingsInput(BaseModel):
    name: str = Field(min_length=2,max_length=80)
    age: int = Field(ge=1,le=120)
    timezone: str
    emergency_contact: str = Field(default='',max_length=120)
    reminder_minutes: int = Field(ge=5,le=60)
    grace_minutes: int = Field(ge=5,le=240)
    notify_caregivers: bool = True

class MedicationInput(BaseModel):
    name: str = Field(min_length=2,max_length=100)
    dosage: str = Field(min_length=1,max_length=80)
    instructions: str = Field(default='',max_length=250)
    times: list[str] = Field(min_length=1,max_length=12)
    active: bool = True

class DoseInput(BaseModel):
    status: str

class AppointmentInput(BaseModel):
    title: str = Field(min_length=2,max_length=120)
    doctor: str = Field(default='',max_length=120)
    location: str = Field(default='',max_length=150)
    notes: str = Field(default='',max_length=250)
    at: str
    cancelled: bool = False

class InvitationInput(BaseModel):
    role: str = 'family'

class JoinInput(BaseModel):
    code: str = Field(min_length=12,max_length=20)

class TransferInput(BaseModel):
    to_user_id: str = Field(min_length=10,max_length=100)


@app.get('/')
def index(): return FileResponse(STATIC/'index.html')

@app.get('/api/health')
def health(): return {'status':'ok','app':'CareCircle AI','backend':os.getenv('DATA_BACKEND','sqlite')}

@app.get('/api/config')
def config(): return {'demo_enabled':os.getenv('DEMO_MODE','0')=='1','mail_mode':('SendGrid' if os.getenv('SENDGRID_API_KEY') else 'SMTP' if os.getenv('SMTP_HOST') else 'Demo (no external emails)')}

@app.post('/api/auth/signup', status_code=201)
def signup(body:Signup):
    email=clean_email(body.email)
    if store.find('users','email',email): fail('Email is already registered',409)
    user={'id':uid(),'name':body.name.strip(),'email':email,'password_hash':hash_password(body.password),'created_at':stamp()}
    # Unique email claim prevents signup races without exposing passwords to clients.
    if not store.create('email_claims',hashlib.sha256(email.encode()).hexdigest(),{'id':user['id']}):
        fail('Email is already registered',409)
    store.put('users',user['id'],user)
    return {'token':sign_token(user['id'],SECRET),'user':safe_user(user)}

@app.post('/api/auth/login')
def login(body:Login,request:Request):
    email=clean_email(body.email)
    key=(request.client.host if request.client else 'unknown')+':'+email
    if not limiter.allowed(key): fail('Too many attempts. Please try later',429)
    users=store.find('users','email',email)
    user=users[0] if users else None
    if not user or not verify_password(body.password,user['password_hash']):
        limiter.record_failure(key)
        fail('Incorrect email or password',401)
    limiter.clear(key)
    return {'token':sign_token(user['id'],SECRET),'user':safe_user(user)}

@app.get('/api/me')
def me(user=Depends(current_user)):
    return safe_user(user)

@app.get('/api/patients')
def patient_list(user=Depends(current_user)):
    result=[]
    for member in store.find('members','user_id',user['id']):
        patient=store.get('patients',member['patient_id'])
        if patient: result.append({**patient,'role':member['role']})
    return sorted(result,key=lambda p:p['name'])

@app.post('/api/patients', status_code=201)
def patient_create(body:PatientInput,user=Depends(current_user)):
    if len(store.find('members','user_id',user['id']))>=10: fail('Profile limit reached')
    must_timezone(body.timezone)
    pid=uid()
    data={'id':pid,'name':body.name.strip(),'age':body.age,'timezone':body.timezone,'emergency_contact':body.emergency_contact.strip(),'owner_id':user['id'],'reminder_minutes':15,'grace_minutes':30,'notify_caregivers':True,'created_at':stamp()}
    store.put('patients',pid,data)
    store.put('members',f'{pid}_{user["id"]}',{'id':f'{pid}_{user["id"]}','patient_id':pid,'user_id':user['id'],'role':'owner','notify':True})
    audit(pid,user['id'],'profile.created')
    return data

@app.patch('/api/patients/{pid}')
def patient_edit(pid:str,body:SettingsInput,user=Depends(current_user)):
    data,_=require_member(pid,user,owner=True)
    must_timezone(body.timezone)
    data.update(body.model_dump())
    store.put('patients',pid,data)
    audit(pid,user['id'],'profile.settings_updated')
    return data

@app.get('/api/patients/{pid}/overview')
def overview(pid:str,user=Depends(current_user)):
    patient,member=require_member(pid,user)
    medications=sorted(store.find('medications','patient_id',pid),key=lambda v:v['created_at'])
    appointments=sorted(store.find('appointments','patient_id',pid),key=lambda v:v['at'])
    members=[]
    for item in store.find('members','patient_id',pid):
        u=store.get('users',item['user_id'])
        if u: members.append({**item,'name':u['name'],'email':u['email']})
    tz=ZoneInfo(patient['timezone'])
    today=datetime.now(tz).date()
    past=today-timedelta(days=6)
    doses=[d for d in store.find('doses','patient_id',pid) if d.get('date','')>=past.isoformat()]
    alerts=sorted(store.find('alerts','patient_id',pid),key=lambda x:x['at'],reverse=True)[:30]
    logs=sorted(store.find('audit','patient_id',pid),key=lambda x:x['at'],reverse=True)[:15]
    pending=store.get('ownership_transfers',pid)
    if pending and (pending['to_user_id'] in (user['id'],) or member['role']=='owner') and datetime.fromisoformat(pending['expires_at']) > utcnow():
        transfer=pending
    else: transfer=None
    return {'patient':patient,'my_role':member['role'],'medications':medications,'appointments':appointments,'members':members,'doses':doses,'alerts':alerts,'audit':logs,'ownership_transfer':transfer,'today':today.isoformat(),'now_hhmm':datetime.now(tz).strftime('%H:%M')}

@app.post('/api/patients/{pid}/medications',status_code=201)
def med_add(pid:str,body:MedicationInput,user=Depends(current_user)):
    patient,_=require_member(pid,user,edit=True)
    mid=uid()
    effective_from=datetime.now(ZoneInfo(patient['timezone'])).date().isoformat()
    doc={'id':mid,'patient_id':pid,**body.model_dump(),'times':valid_times(body.times),'effective_from':effective_from,'created_by':user['id'],'created_at':stamp()}
    store.put('medications',mid,doc)
    audit(pid,user['id'],'medication.added',body.name)
    return doc

@app.patch('/api/patients/{pid}/medications/{mid}')
def med_edit(pid:str,mid:str,body:MedicationInput,user=Depends(current_user)):
    patient,_=require_member(pid,user,edit=True)
    med=store.get('medications',mid)
    if not med or med['patient_id']!=pid: fail('Medication not found',404)
    if sorted(body.times)!=med['times'] or (body.active and not med.get('active', True)):
        med['effective_from']=datetime.now(ZoneInfo(patient['timezone'])).date().isoformat()
    med.update(body.model_dump())
    med['times']=valid_times(body.times)
    med['updated_at']=stamp()
    store.put('medications',mid,med)
    audit(pid,user['id'],'medication.updated',med['name'])
    return med

@app.delete('/api/patients/{pid}/medications/{mid}')
def med_archive(pid:str,mid:str,user=Depends(current_user)):
    require_member(pid,user,edit=True)
    med=store.get('medications',mid)
    if not med or med['patient_id']!=pid: fail('Medication not found',404)
    med['active']=False
    store.put('medications',mid,med)
    audit(pid,user['id'],'medication.archived',med['name'])
    return {'ok':True}

@app.put('/api/patients/{pid}/doses/{mid}/{day}/{hhmm}')
def dose_update(pid:str,mid:str,day:str,hhmm:str,body:DoseInput,user=Depends(current_user)):
    patient,_=require_member(pid,user,edit=True)
    med=store.get('medications',mid)
    if not med or med['patient_id']!=pid: fail('Medication not found',404)
    if hhmm not in med['times']: fail('Time is not in this medication schedule')
    if body.status not in ('taken','skipped','pending'): fail('Invalid dose status')
    try: parsed_day=date.fromisoformat(day)
    except ValueError: fail('Invalid date')
    now_date=datetime.now(ZoneInfo(patient['timezone'])).date()
    if parsed_day>now_date or parsed_day<now_date-timedelta(days=30): fail('Can only confirm doses from the last 30 days, not future doses')
    did=f'{mid}:{day}:{hhmm}'
    if body.status=='pending':
        store.delete('doses',did)
    else:
        doc={'id':did,'patient_id':pid,'medication_id':mid,'date':day,'time':hhmm,'status':body.status,'recorded_by':user['id'],'recorded_at':stamp()}
        store.put('doses',did,doc)
    audit(pid,user['id'],'dose.'+body.status,med['name']+' '+hhmm)
    return {'ok':True,'status':body.status}

@app.post('/api/patients/{pid}/appointments',status_code=201)
def appt_add(pid:str,body:AppointmentInput,user=Depends(current_user)):
    require_member(pid,user,edit=True)
    aid=uid()
    doc={'id':aid,'patient_id':pid,**body.model_dump(),'at':valid_appt(body.at),'created_by':user['id'],'created_at':stamp()}
    store.put('appointments',aid,doc)
    audit(pid,user['id'],'appointment.added',body.title)
    return doc

@app.patch('/api/patients/{pid}/appointments/{aid}')
def appt_edit(pid:str,aid:str,body:AppointmentInput,user=Depends(current_user)):
    require_member(pid,user,edit=True)
    appt=store.get('appointments',aid)
    if not appt or appt['patient_id']!=pid: fail('Appointment not found',404)
    appt.update(body.model_dump())
    appt['at']=valid_appt(body.at)
    store.put('appointments',aid,appt)
    audit(pid,user['id'],'appointment.updated',body.title)
    return appt

@app.delete('/api/patients/{pid}/appointments/{aid}')
def appt_cancel(pid:str,aid:str,user=Depends(current_user)):
    require_member(pid,user,edit=True)
    appt=store.get('appointments',aid)
    if not appt or appt['patient_id']!=pid: fail('Appointment not found',404)
    appt['cancelled']=True
    store.put('appointments',aid,appt)
    audit(pid,user['id'],'appointment.cancelled',appt['title'])
    return {'ok':True}

@app.post('/api/patients/{pid}/invitations',status_code=201)
def invite(pid:str,body:InvitationInput,user=Depends(current_user)):
    require_member(pid,user,owner=True)
    if body.role not in ('family','caregiver','viewer'): fail('Invalid member role')
    code=new_invite()
    doc={'id':code_digest(code),'patient_id':pid,'role':body.role,'expires_at':(utcnow()+timedelta(hours=24)).isoformat(),'used_by':None,'invited_by':user['id']}
    store.put('invites',doc['id'],doc)
    audit(pid,user['id'],'invitation.created',body.role)
    return {'code':code,'role':body.role,'expires_at':doc['expires_at'],'note':'Share privately; this one-use code expires after 24 hours.'}

@app.post('/api/invitations/redeem')
def redeem(body:JoinInput,user=Depends(current_user)):
    key=code_digest(body.code)
    inv=store.get('invites',key)
    if not inv or inv.get('used_by') or datetime.fromisoformat(inv['expires_at'])<utcnow():
        fail('Invite invalid, expired, or already used',400)
    patient=store.get('patients',inv['patient_id'])
    if not patient: fail('Profile no longer available',404)
    if store.get('members',f'{patient["id"]}_{user["id"]}'):
        fail('Already a member of this care circle',409)
    mid=f'{patient["id"]}_{user["id"]}'
    # Atomic single-use claim: creating this record can only succeed once, even concurrently.
    if not store.create('invite_claims',key,{'id':key,'claimed_by':user['id']}):
        fail('Code has already been redeemed',409)
    store.put('members',mid,{'id':mid,'patient_id':patient['id'],'user_id':user['id'],'role':inv['role'],'notify':True})
    inv['used_by']=user['id']
    store.put('invites',key,inv)
    audit(patient['id'],user['id'],'member.joined',inv['role'])
    return {'ok':True,'patient_id':patient['id'],'name':patient['name']}

@app.delete('/api/patients/{pid}/members/{member_user_id}')
def member_remove(pid:str,member_user_id:str,user=Depends(current_user)):
    patient,_=require_member(pid,user)
    if member_user_id==patient['owner_id']:
        fail('The profile owner cannot be removed')
    if user['id']!=member_user_id:
        require_member(pid,user,owner=True)
    key=f'{pid}_{member_user_id}'
    if not store.get('members',key): fail('Member not found',404)
    store.delete('members',key)
    audit(pid,user['id'],'member.removed')
    return {'ok':True}

@app.post('/api/patients/{pid}/ownership/request')
def ownership_request(pid:str,body:TransferInput,user=Depends(current_user)):
    patient,_=require_member(pid,user,owner=True)
    target=store.get('members',f'{pid}_{body.to_user_id}')
    if not target or target['role']=='owner': fail('Select another existing circle member')
    doc={'patient_id':pid,'to_user_id':body.to_user_id,'requested_by':user['id'],'expires_at':(utcnow()+timedelta(hours=24)).isoformat()}
    store.put('ownership_transfers',pid,doc)
    audit(pid,user['id'],'ownership.transfer_requested')
    return {'ok':True,'expires_at':doc['expires_at']}

@app.post('/api/patients/{pid}/ownership/accept')
def ownership_accept(pid:str,user=Depends(current_user)):
    patient,_=require_member(pid,user)
    pending=store.get('ownership_transfers',pid)
    if not pending or pending['to_user_id']!=user['id'] or datetime.fromisoformat(pending['expires_at'])<=utcnow():
        fail('No valid ownership request for your account')
    previous=store.get('members',f'{pid}_{patient["owner_id"]}')
    current=store.get('members',f'{pid}_{user["id"]}')
    if not previous or not current: fail('Care circle membership changed')
    previous['role']='family'
    current['role']='owner'
    store.put('members',previous['id'],previous)
    store.put('members',current['id'],current)
    patient['owner_id']=user['id']
    store.put('patients',pid,patient)
    store.delete('ownership_transfers',pid)
    audit(pid,user['id'],'ownership.accepted')
    return {'ok':True}

@app.delete('/api/patients/{pid}/ownership/request')
def ownership_cancel(pid:str,user=Depends(current_user)):
    require_member(pid,user,owner=True)
    store.delete('ownership_transfers',pid)
    audit(pid,user['id'],'ownership.transfer_cancelled')
    return {'ok':True}


@app.post('/api/scheduler/run')
def scheduler_run(x_scheduler_key:str|None=Header(None)):
    configured=os.getenv('SCHEDULER_SECRET','')
    if not configured or not x_scheduler_key or not hmac.compare_digest(x_scheduler_key,configured):
        fail('Unauthorized scheduler',403)
    return run_checks(store)

@app.post('/api/patients/{pid}/demo-alert')
def demo_alert(pid:str,user=Depends(current_user)):
    if os.getenv('DEMO_MODE')!='1': fail('Demo alerts disabled',404)
    require_member(pid,user,owner=True)
    a_id=uid()
    doc={'id':a_id,'patient_id':pid,'email':user['email'],'title':'CareCircle check-in preview','kind':'unconfirmed','body':'This demonstrates the caregiver notification shown when a dose has not been confirmed. No email was sent.','state':'demo','at':stamp()}
    store.put('alerts',a_id,doc)
    return {'ok':True}


def seed_demo():
    if os.getenv('DEMO_MODE')!='1': return
    email='demo@carecircle.app'
    if store.find('users','email',email): return
    user_id=uid()
    user={'id':user_id,'name':'Demo Family','email':email,'password_hash':hash_password('Demo@12345'),'created_at':stamp()}
    store.create('email_claims',hashlib.sha256(email.encode()).hexdigest(),{'id':user_id})
    store.put('users',user_id,user)
    pid=uid()
    patient={'id':pid,'name':'Meera Sharma','age':72,'timezone':'Asia/Kolkata','emergency_contact':'Family emergency contact','owner_id':user_id,'reminder_minutes':15,'grace_minutes':30,'notify_caregivers':True,'created_at':stamp()}
    store.put('patients',pid,patient)
    store.put('members',f'{pid}_{user_id}',{'id':f'{pid}_{user_id}','patient_id':pid,'user_id':user_id,'role':'owner','notify':True})
    for name,dosage,times,notes in [('Vitamin D','1 tablet',['09:00'],'With breakfast; example only'),('Blood pressure medicine','As prescribed',['08:00','20:00'],'Use the label instructions; example only'),('Daily supplement','1 capsule',['13:00'],'Example schedule')]:
        key=uid()
        store.put('medications',key,{'id':key,'patient_id':pid,'name':name,'dosage':dosage,'times':times,'instructions':notes,'active':True,'effective_from':datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat(),'created_by':user_id,'created_at':stamp()})
    for offset,title,doctor,place in [(1,'Routine check-up','Dr. Arora','City Clinic'),(5,'Follow-up consultation','Dr. Iyer','Community Health Centre')]:
        key=uid()
        at=(datetime.now(ZoneInfo('Asia/Kolkata'))+timedelta(days=offset)).replace(hour=11,minute=30).strftime('%Y-%m-%dT%H:%M')
        store.put('appointments',key,{'id':key,'patient_id':pid,'title':title,'doctor':doctor,'location':place,'notes':'Demo appointment','at':at,'cancelled':False,'created_by':user_id,'created_at':stamp()})
    # Example historical adherence so the graph contains useful data.
    for med in store.find('medications','patient_id',pid):
        for lag in range(1,7):
            day=(datetime.now(ZoneInfo('Asia/Kolkata')).date()-timedelta(days=lag)).isoformat()
            for t in med['times']:
                if (lag+int(t[:2]))%5!=0:
                    did=f'{med["id"]}:{day}:{t}'
                    store.put('doses',did,{'id':did,'patient_id':pid,'medication_id':med['id'],'date':day,'time':t,'status':'taken','recorded_by':user_id,'recorded_at':stamp()})
    audit(pid,user_id,'demo.ready','Example data only; not medical advice')


seed_demo()
