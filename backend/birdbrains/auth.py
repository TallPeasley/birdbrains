"""Request authentication.

Production verifies Firebase Auth ID tokens. ``BIRDBRAINS_AUTH=dev`` accepts
``Authorization: Bearer dev:<uid>`` instead and exists only for local runs and
tests; the app refuses to start in that mode on Cloud Run.
"""
from __future__ import annotations

import re
from typing import Protocol

from fastapi import HTTPException


class Authenticator(Protocol):
    def verify(self, token: str) -> str:
        """Return the caller's uid or raise HTTPException(401)."""


class DevAuthenticator:
    _UID = re.compile(r"^dev:([A-Za-z0-9_-]{1,64})$")

    def verify(self, token: str) -> str:
        m = self._UID.match(token)
        if not m:
            raise HTTPException(401, "Invalid dev token")
        return m.group(1)


class FirebaseAuthenticator:
    def __init__(self, project: str | None = None) -> None:
        import firebase_admin

        try:
            self._app = firebase_admin.get_app()
        except ValueError:
            self._app = firebase_admin.initialize_app(options={"projectId": project} if project else None)

    def verify(self, token: str) -> str:
        from firebase_admin import auth

        try:
            return auth.verify_id_token(token, app=self._app)["uid"]
        except Exception:
            raise HTTPException(401, "Invalid or expired sign-in token")
