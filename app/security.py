"""Session signing, scrypt passwords, and basic request throttling."""
from __future__ import annotations
import base64
import hashlib
import hmac
import json
import os
import secrets
import time


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1)
    return 'scrypt$' + base64.urlsafe_b64encode(salt).decode() + '$' + base64.urlsafe_b64encode(key).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        kind, salt64, key64 = encoded.split('$')
        if kind != 'scrypt':
            return False
        salt, key = base64.urlsafe_b64decode(salt64), base64.urlsafe_b64decode(key64)
        guess = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(guess, key)
    except (ValueError, TypeError):
        return False


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def sign_token(user_id: str, secret: str) -> str:
    header = b64url(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64url(json.dumps({'sub':user_id, 'iat':int(time.time()),'exp':int(time.time())+12*3600},separators=(',',':')).encode())
    body = header + '.' + payload
    signature = b64url(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest())
    return body + '.' + signature


def verify_token(token: str, secret: str) -> str | None:
    try:
        header, payload, sig = token.split('.')
        body = header + '.' + payload
        expected = b64url(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest())
        if not hmac.compare_digest(sig,expected):
            return None
        head = json.loads(base64.urlsafe_b64decode(header+'='*(-len(header)%4)))
        if head.get('alg') != 'HS256':
            return None
        data = json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
        if not isinstance(data.get('exp'),int) or data['exp'] <= time.time():
            return None
        return data.get('sub') if isinstance(data.get('sub'), str) else None
    except (ValueError,KeyError,TypeError):
        return None


def code_digest(code: str) -> str:
    return hashlib.sha256(code.replace('-','').upper().encode()).hexdigest()


def new_invite() -> str:
    alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    raw=''.join(secrets.choice(alphabet) for _ in range(12))
    return '-'.join((raw[:4],raw[4:8],raw[8:]))


class LoginLimiter:
    def __init__(self):
        self.buckets={}

    def allowed(self, key):
        now=time.monotonic()
        self.buckets[key]=[t for t in self.buckets.get(key,[]) if t>now-900]
        if len(self.buckets)>10000:
            self.buckets.clear()
        return len(self.buckets[key])<10

    def record_failure(self,key):
        self.buckets.setdefault(key,[]).append(time.monotonic())

    def clear(self,key):
        self.buckets.pop(key,None)
