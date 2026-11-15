"""End-to-end API smoke tests with isolated temporary SQLite data."""
import os
import pathlib
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
os.environ['APP_ENV']='development'
os.environ['DEMO_MODE']='0'
os.environ['DATA_BACKEND']='sqlite'
os.environ['SQLITE_PATH']=f'/tmp/carecircle-test-{uuid.uuid4().hex}.sqlite3'
os.environ['APP_SECRET']='test-secret-unique-and-long-enough-for-app'
os.environ['SCHEDULER_SECRET']='a-test-scheduler-secret'

from fastapi.testclient import TestClient
from app.main import app, store
from app.alerts import run_checks

client=TestClient(app)

def register(name,email):
    r=client.post('/api/auth/signup',json={'name':name,'email':email,'password':'testpassword123'})
    assert r.status_code==201, r.text
    return {'Authorization':'Bearer '+r.json()['token']}

def test_care_workflow_and_permissions():
    owner=register('Owner','owner@test.example')
    viewer=register('Viewer','viewer@test.example')
    outsider=register('Other','other@test.example')
    response=client.post('/api/patients',json={'name':'Example Senior','age':77,'timezone':'UTC'},headers=owner)
    assert response.status_code==201
    pid=response.json()['id']
    assert client.get('/api/patients/'+pid+'/overview',headers=outsider).status_code==403
    med=client.post(f'/api/patients/{pid}/medications',json={'name':'Sample tablet','dosage':'As directed','times':['08:00','20:00'],'instructions':'example only','active':True},headers=owner)
    assert med.status_code==201, med.text
    mid=med.json()['id']
    assert client.get('/api/patients',headers=owner).json()[0]['name']=='Example Senior'
    inv=client.post(f'/api/patients/{pid}/invitations',json={'role':'viewer'},headers=owner)
    assert inv.status_code==201
    code=inv.json()['code']
    assert client.post('/api/invitations/redeem',json={'code':code},headers=viewer).status_code==200
    assert client.post('/api/invitations/redeem',json={'code':code},headers=outsider).status_code==400
    assert client.get(f'/api/patients/{pid}/overview',headers=viewer).status_code==200
    forbidden=client.post(f'/api/patients/{pid}/medications',json={'name':'Unauthorized','dosage':'1','times':['07:00']},headers=viewer)
    assert forbidden.status_code==403
    day=datetime.now(timezone.utc).date().isoformat()
    dose=client.put(f'/api/patients/{pid}/doses/{mid}/{day}/08:00',json={'status':'taken'},headers=owner)
    assert dose.status_code==200,dose.text
    bad_future=(datetime.now(timezone.utc).date()+timedelta(days=2)).isoformat()
    assert client.put(f'/api/patients/{pid}/doses/{mid}/{bad_future}/08:00',json={'status':'taken'},headers=owner).status_code==400
    assert client.get(f'/api/patients/{pid}/overview',headers=owner).json()['doses'][0]['status']=='taken'
    assert client.post('/api/scheduler/run').status_code==403
    assert client.delete(f'/api/patients/{pid}/members/{owner["Authorization"]}',headers=viewer).status_code==403
    viewer_id=client.get('/api/me',headers=viewer).json()['id']
    assert client.post(f'/api/patients/{pid}/ownership/request',json={'to_user_id':viewer_id},headers=owner).status_code==200
    assert client.get(f'/api/patients/{pid}/overview',headers=viewer).json()['ownership_transfer'] is not None
    assert client.post(f'/api/patients/{pid}/ownership/accept',headers=viewer).status_code==200
    assert client.get(f'/api/patients/{pid}/overview',headers=viewer).json()['my_role']=='owner'
    assert client.post(f'/api/patients/{pid}/invitations',json={'role':'family'},headers=owner).status_code==403


def test_alert_idempotency_and_disabled_email():
    from app.store import SQLiteStore
    tmp=SQLiteStore(f'/tmp/carecircle-alert-test-{uuid.uuid4().hex}.sqlite3')
    now=datetime(2026,11,15,9,0,tzinfo=timezone.utc)
    tmp.put('users','own',{'id':'own','email':'elder@test.example','name':'Elder'})
    tmp.put('users','helper',{'id':'helper','email':'helper@test.example','name':'Helper'})
    tmp.put('patients','p',{'id':'p','name':'Elder','age':72,'owner_id':'own','timezone':'UTC','reminder_minutes':15,'grace_minutes':30,'notify_caregivers':True})
    tmp.put('members','p_own',{'patient_id':'p','user_id':'own','role':'owner'})
    tmp.put('members','p_helper',{'patient_id':'p','user_id':'helper','role':'caregiver','notify':True})
    tmp.put('medications','med',{'id':'med','patient_id':'p','name':'Example','dosage':'1 unit','times':['09:10','08:00'],'active':True})
    first=run_checks(tmp,now)
    assert first['alert_attempts']==2,first
    again=run_checks(tmp,now)
    assert again['alert_attempts']==0,again
    alerts=tmp.find('alerts','patient_id','p')
    assert {a['kind'] for a in alerts}=={'medication','unconfirmed'}
    assert all(a['state']=='demo' for a in alerts)
    tmp.put('doses','med:2026-11-15:08:00',{'id':'med:2026-11-15:08:00','patient_id':'p','status':'taken'})
    assert run_checks(tmp,now)['alert_attempts']==0
