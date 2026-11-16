"""Record persistence: Firestore in production, in-memory for local runs and tests.

A deliberately small document interface. Collections used: users, linkcodes,
submissions, imagehashes, transcriptions, gradings, worksheets, ledgers,
batchjobs, tenants, schools, classes, joincodes, usagecounters.
"""
from __future__ import annotations

import copy
import threading
from typing import Any, Optional, Protocol


class Store(Protocol):
    def get(self, collection: str, doc_id: str) -> Optional[dict]: ...

    def put(self, collection: str, doc_id: str, doc: dict) -> None: ...

    def query(self, collection: str, field: str, value: Any) -> list[dict]: ...

    def query_contains(self, collection: str, field: str, value: Any) -> list[dict]:
        """Documents whose list ``field`` contains ``value``."""

    def query_since(self, collection: str, field: str, value: str) -> list[dict]:
        """Documents whose ISO-8601 time ``field`` is at or after ``value``."""

    def add_to_counter(self, collection: str, doc_id: str, delta: int, limit: Optional[int] = None,
                       seed: int = 0, fields: Optional[dict] = None) -> bool:
        """Atomically add ``delta`` to the document's ``count``. A missing document
        starts at ``seed`` (with ``fields`` stored beside the count). Returns False,
        changing nothing, when the result would be above ``limit``."""

    def delete(self, collection: str, doc_id: str) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, dict[str, dict]] = {}
        self._lock = threading.Lock()

    def get(self, collection: str, doc_id: str) -> Optional[dict]:
        doc = self._data.get(collection, {}).get(doc_id)
        return copy.deepcopy(doc) if doc is not None else None

    def put(self, collection: str, doc_id: str, doc: dict) -> None:
        self._data.setdefault(collection, {})[doc_id] = copy.deepcopy(doc)

    def query(self, collection: str, field: str, value: Any) -> list[dict]:
        return [copy.deepcopy(d) for d in self._data.get(collection, {}).values() if d.get(field) == value]

    def query_contains(self, collection: str, field: str, value: Any) -> list[dict]:
        return [copy.deepcopy(d) for d in self._data.get(collection, {}).values() if value in (d.get(field) or [])]

    def query_since(self, collection: str, field: str, value: str) -> list[dict]:
        return [copy.deepcopy(d) for d in self._data.get(collection, {}).values() if (d.get(field) or "") >= value]

    def add_to_counter(self, collection: str, doc_id: str, delta: int, limit: Optional[int] = None,
                       seed: int = 0, fields: Optional[dict] = None) -> bool:
        with self._lock:
            docs = self._data.setdefault(collection, {})
            doc = docs.get(doc_id) or {**(fields or {}), "count": seed}
            new = max(doc["count"] + delta, 0)
            if limit is not None and delta > 0 and new > limit:
                return False
            docs[doc_id] = {**doc, "count": new}
            return True

    def delete(self, collection: str, doc_id: str) -> None:
        self._data.get(collection, {}).pop(doc_id, None)


class FirestoreStore:
    """Firestore (Native mode). Create the database in northamerica-northeast1."""

    def __init__(self, project: Optional[str] = None, database: str = "(default)") -> None:
        from google.cloud import firestore

        self._db = firestore.Client(project=project, database=database)

    def get(self, collection: str, doc_id: str) -> Optional[dict]:
        snap = self._db.collection(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def put(self, collection: str, doc_id: str, doc: dict) -> None:
        self._db.collection(collection).document(doc_id).set(doc)

    def query(self, collection: str, field: str, value: Any) -> list[dict]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        q = self._db.collection(collection).where(filter=FieldFilter(field, "==", value))
        return [s.to_dict() for s in q.stream()]

    def query_contains(self, collection: str, field: str, value: Any) -> list[dict]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        q = self._db.collection(collection).where(filter=FieldFilter(field, "array_contains", value))
        return [s.to_dict() for s in q.stream()]

    def query_since(self, collection: str, field: str, value: str) -> list[dict]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        q = self._db.collection(collection).where(filter=FieldFilter(field, ">=", value))
        return [s.to_dict() for s in q.stream()]

    def add_to_counter(self, collection: str, doc_id: str, delta: int, limit: Optional[int] = None,
                       seed: int = 0, fields: Optional[dict] = None) -> bool:
        from google.cloud import firestore

        ref = self._db.collection(collection).document(doc_id)

        @firestore.transactional
        def run(tx) -> bool:
            # Firestore retries the whole function if another request changed the
            # document in between, so two uploads can never both take the last slot.
            snap = ref.get(transaction=tx)
            doc = snap.to_dict() if snap.exists else {**(fields or {}), "count": seed}
            new = max(doc["count"] + delta, 0)
            if limit is not None and delta > 0 and new > limit:
                return False
            tx.set(ref, {**doc, "count": new})
            return True

        return run(self._db.transaction())

    def delete(self, collection: str, doc_id: str) -> None:
        self._db.collection(collection).document(doc_id).delete()
