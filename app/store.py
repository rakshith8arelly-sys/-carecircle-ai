"""Small document-store adapter. SQLite for local demos; Firestore for Cloud Run."""
from __future__ import annotations
import json
import os
import sqlite3
import threading
from pathlib import Path


class SQLiteStore:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("CREATE TABLE IF NOT EXISTS docs (collection TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection,id))")
        self.conn.commit()
        self.lock = threading.RLock()

    def get(self, collection, key):
        with self.lock:
            row = self.conn.execute("SELECT payload FROM docs WHERE collection=? AND id=?", (collection, key)).fetchone()
            return json.loads(row[0]) if row else None

    def put(self, collection, key, value):
        with self.lock:
            self.conn.execute("INSERT INTO docs VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload", (collection,key,json.dumps(value)))
            self.conn.commit()

    def create(self, collection, key, value):
        with self.lock:
            try:
                self.conn.execute("INSERT INTO docs VALUES(?,?,?)", (collection,key,json.dumps(value)))
                self.conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False

    def delete(self, collection, key):
        with self.lock:
            self.conn.execute("DELETE FROM docs WHERE collection=? AND id=?",(collection,key))
            self.conn.commit()

    def find(self, collection, field=None, value=None):
        with self.lock:
            rows = self.conn.execute("SELECT payload FROM docs WHERE collection=?", (collection,)).fetchall()
        docs = [json.loads(row[0]) for row in rows]
        return [d for d in docs if d.get(field) == value] if field is not None else docs


class FirestoreStore:
    def __init__(self):
        from google.cloud import firestore
        self.client = firestore.Client()

    def get(self, collection, key):
        doc = self.client.collection(collection).document(key).get()
        return doc.to_dict() if doc.exists else None

    def put(self, collection, key, value):
        self.client.collection(collection).document(key).set(value)

    def create(self, collection, key, value):
        from google.api_core.exceptions import Conflict
        try:
            self.client.collection(collection).document(key).create(value)
            return True
        except Conflict:
            return False

    def delete(self, collection, key):
        self.client.collection(collection).document(key).delete()

    def find(self, collection, field=None, value=None):
        ref = self.client.collection(collection)
        if field is not None:
            from google.cloud.firestore_v1.base_query import FieldFilter
            ref = ref.where(filter=FieldFilter(field, '==', value))
        return [item.to_dict() for item in ref.stream()]


def make_store():
    backend = os.getenv('DATA_BACKEND', 'sqlite').lower()
    if backend == 'firestore':
        return FirestoreStore()
    if backend == 'sqlite':
        return SQLiteStore(os.getenv('SQLITE_PATH', './data/carecircle.sqlite3'))
    raise RuntimeError(f'Unknown DATA_BACKEND: {backend}')
