"""Blob storage for photos and batch files: Cloud Storage in production, a local
directory otherwise. Paths are bucket-relative; URIs are ``gs://`` or ``file://``."""
from __future__ import annotations

from pathlib import Path
from typing import Optional, Protocol


class BlobStorage(Protocol):
    def write_bytes(self, path: str, data: bytes, content_type: str) -> str: ...

    def read_bytes(self, path: str) -> bytes: ...

    def write_text(self, path: str, text: str) -> str: ...

    def read_texts(self, prefix: str, suffix: str) -> list[str]: ...

    def delete_prefix(self, prefix: str) -> int:
        """Delete every object under ``prefix``; return how many were removed."""


class LocalStorage:
    def __init__(self, root: str) -> None:
        self._root = Path(root).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, path: str) -> Path:
        p = (self._root / path).resolve()
        if not p.is_relative_to(self._root):
            raise ValueError("path escapes storage root")
        return p

    def write_bytes(self, path: str, data: bytes, content_type: str) -> str:
        p = self._path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return p.as_uri()

    def read_bytes(self, path: str) -> bytes:
        return self._path(path).read_bytes()

    def write_text(self, path: str, text: str) -> str:
        return self.write_bytes(path, text.encode(), "text/plain")

    def read_texts(self, prefix: str, suffix: str) -> list[str]:
        base = self._path(prefix)
        if not base.exists():
            return []
        return [p.read_text() for p in sorted(base.rglob(f"*{suffix}")) if p.is_file()]

    def delete_prefix(self, prefix: str) -> int:
        base = self._path(prefix)
        files = [p for p in base.rglob("*") if p.is_file()] if base.exists() else []
        for f in files:
            f.unlink()
        return len(files)


class GcsStorage:
    """Bucket should live in northamerica-northeast1 with uniform access and no
    public access. Objects are only ever served through the authenticated API."""

    def __init__(self, bucket: str, project: Optional[str] = None) -> None:
        from google.cloud import storage

        self._bucket_name = bucket
        self._bucket = storage.Client(project=project).bucket(bucket)

    def write_bytes(self, path: str, data: bytes, content_type: str) -> str:
        self._bucket.blob(path).upload_from_string(data, content_type=content_type)
        return f"gs://{self._bucket_name}/{path}"

    def read_bytes(self, path: str) -> bytes:
        return self._bucket.blob(path).download_as_bytes()

    def write_text(self, path: str, text: str) -> str:
        return self.write_bytes(path, text.encode(), "application/jsonl")

    def read_texts(self, prefix: str, suffix: str) -> list[str]:
        return [
            b.download_as_text()
            for b in self._bucket.list_blobs(prefix=prefix)
            if b.name.endswith(suffix)
        ]

    def delete_prefix(self, prefix: str) -> int:
        blobs = list(self._bucket.list_blobs(prefix=prefix))
        for b in blobs:
            b.delete()
        return len(blobs)
