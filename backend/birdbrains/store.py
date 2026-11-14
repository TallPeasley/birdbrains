"""Record persistence: Firestore in production, in-memory for local runs and tests.

A deliberately small document interface. Collections used: users, linkcodes,
submissions, imagehashes, transcriptions, gradings, worksheets, ledgers,
batchjobs, tenants, schools, classes, joincodes.
"""
from __future__ import annotations

import copy
from typing import Any, Optional, Protocol


class Store(Protocol):
    def get(self, collection: str, doc_id: str) -> Optional[dict]: ...

    def put(self, collection: str, doc_id: str, doc: dict) -> None: ...

    def query(self, collection: str, field: str, value: Any) -> list[dict]: ...

    def query_contains(self, collection: str, field: str, value: Any) -> list[dict]:
        """Documents whose list ``field`` contains ``value``."""

    def delete(self, collection: str, doc_id: str) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, dict[str, dict]] = {}

    def get(self, collection: str, doc_id: str) -> Optional[dict]:
        doc = self._data.get(collection, {}).get(doc_id)
        return copy.deepcopy(doc) if doc is not None else None

    def put(self, collection: str, doc_id: str, doc: dict) -> None:
        self._data.setdefault(collection, {})[doc_id] = copy.deepcopy(doc)

    def query(self, collection: str, field: str, value: Any) -> list[dict]:
        return [copy.deepcopy(d) for d in self._data.get(collection, {}).values() if d.get(field) == value]

    def query_contains(self, collection: str, field: str, value: Any) -> list[dict]:
        return [copy.deepcopy(d) for d in self._data.get(collection, {}).values() if value in (d.get(field) or [])]

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

    def delete(self, collection: str, doc_id: str) -> None:
        self._db.collection(collection).document(doc_id).delete()
