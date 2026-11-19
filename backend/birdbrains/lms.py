"""Multi-LMS OAuth integrations (Brightspace D2L, Canvas LMS, Microsoft Teams for Education):
OAuth2 connect, SSO identity, reading courses/assignments/student submissions,
and syncing BirdBrains grades and feedback back to the LMS.

Plain HTTPS calls (urllib); no external OAuth client libraries required.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Protocol

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024

LMS_PROVIDERS = {
    "brightspace": {
        "name": "Brightspace (D2L)",
        "requiresInstanceUrl": True,
        "defaultPlaceholder": "https://school.brightspace.com",
    },
    "canvas": {
        "name": "Canvas LMS",
        "requiresInstanceUrl": True,
        "defaultPlaceholder": "https://school.instructure.com",
    },
    "microsoft_edu": {
        "name": "Microsoft Teams for Education",
        "requiresInstanceUrl": False,
        "defaultPlaceholder": "",
    },
}


class LmsError(Exception):
    pass


def normalize_instance_url(url: Optional[str]) -> str:
    """Validate and normalize a school's LMS base URL (HTTPS only)."""
    if not url or not url.strip():
        raise LmsError("School LMS URL is required")
    parsed = urllib.parse.urlparse(url.strip().rstrip("/"))
    if parsed.scheme != "https" or not parsed.netloc:
        raise LmsError("School LMS URL must start with https://")
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1") or host.startswith("169.254."):
        raise LmsError("Invalid school LMS host")
    return f"https://{parsed.netloc}"


class LmsSession(Protocol):
    def courses(self) -> list[dict]:
        """[{id, name, section}]"""

    def assignments(self, course_id: str) -> list[dict]:
        """[{id, title}]"""

    def student_names(self, course_id: str) -> dict[str, str]:
        """{lms_user_id: full_name}"""

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        """[{id, userId, state, files: [{id, title, url}]}]"""

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        """(bytes, mime_type). Raises LmsError if not a supported image."""

    def sync_grade(
        self,
        course_id: str,
        work_id: str,
        lms_user_id: str,
        submission_id: Optional[str],
        score: float,
        max_score: float,
        feedback: str,
    ) -> None:
        """Push grade and/or feedback back to the LMS."""


class LmsProvider(Protocol):
    provider_id: str
    requires_instance_url: bool

    def auth_url(self, state: str, instance_url: Optional[str] = None, sso: bool = False) -> str: ...

    def exchange(self, code: str, instance_url: Optional[str] = None) -> dict:
        """Authorization code -> token bundle dict (access_token, refresh_token, instance_url)."""

    def open(self, token_data: dict) -> LmsSession: ...

    def revoke(self, token_data: dict) -> None: ...

    def user_info(self, access_token: str, instance_url: Optional[str] = None) -> dict:
        """Return {sub, name, email} for SSO sign-in."""


def _call(req: urllib.request.Request, limit: Optional[int] = None) -> tuple[bytes, dict]:
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read((limit or 50_000_000) + 1)
            headers = {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as e:
        raise LmsError(f"LMS returned {e.code}") from None
    except OSError as e:
        raise LmsError(f"LMS unreachable: {e}") from None
    if limit and len(data) > limit:
        raise LmsError("file too large")
    return data, headers


def _json_req(url: str, headers: dict, method: str = "GET", payload: Optional[dict] = None):
    body = json.dumps(payload).encode() if payload is not None else None
    req_headers = dict(headers)
    if payload is not None:
        req_headers["Content-Type"] = "application/json"
    data, _ = _call(urllib.request.Request(url, data=body, headers=req_headers, method=method))
    return json.loads(data) if data else {}


# --------------------------------------------------------------------------- Brightspace (D2L)
class BrightspaceProvider:
    provider_id = "brightspace"
    requires_instance_url = True
    AUTH_URL = "https://auth.brightspace.com/oauth2/auth"
    TOKEN_URL = "https://auth.brightspace.com/core/connect/token"
    LMS_SCOPES = "core:*:* enrollments:own:read content:*:* grades:gradevalues:write dropbox:*:* users:own:read"
    SSO_SCOPES = "openid profile email users:own:read"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, sso_redirect_uri: str = "") -> None:
        self._id = client_id
        self._secret = client_secret
        self._redirect = redirect_uri
        self._sso_redirect = sso_redirect_uri or redirect_uri

    def auth_url(self, state: str, instance_url: Optional[str] = None, sso: bool = False) -> str:
        normalize_instance_url(instance_url)
        q = {
            "client_id": self._id,
            "redirect_uri": self._sso_redirect if sso else self._redirect,
            "response_type": "code",
            "scope": self.SSO_SCOPES if sso else self.LMS_SCOPES,
            "state": state,
        }
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(q)}"

    def _token(self, fields: dict) -> dict:
        body = urllib.parse.urlencode(
            {"client_id": self._id, "client_secret": self._secret, **fields}
        ).encode()
        data, _ = _call(urllib.request.Request(self.TOKEN_URL, data=body, method="POST"))
        return json.loads(data)

    def exchange(self, code: str, instance_url: Optional[str] = None, sso: bool = False) -> dict:
        base = normalize_instance_url(instance_url)
        tok = self._token(
            {
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self._sso_redirect if sso else self._redirect,
            }
        )
        if not tok.get("access_token"):
            raise LmsError("Brightspace did not return an access token")
        return {
            "access_token": tok["access_token"],
            "refresh_token": tok.get("refresh_token", ""),
            "instance_url": base,
        }

    def open(self, token_data: dict) -> "BrightspaceSession":
        base = normalize_instance_url(token_data.get("instance_url"))
        refresh = token_data.get("refresh_token")
        if refresh:
            tok = self._token({"refresh_token": refresh, "grant_type": "refresh_token"})
            access = tok["access_token"]
        else:
            access = token_data["access_token"]
        return BrightspaceSession(base, access)

    def revoke(self, token_data: dict) -> None:
        pass  # Brightspace tokens expire naturally; local record is deleted

    def user_info(self, access_token: str, instance_url: Optional[str] = None) -> dict:
        base = normalize_instance_url(instance_url)
        who = _json_req(f"{base}/d2l/api/lp/1.43/users/whoami", {"Authorization": f"Bearer {access_token}"})
        name = " ".join(p for p in (who.get("FirstName"), who.get("LastName")) if p).strip() or "Teacher"
        return {
            "sub": str(who.get("Identifier") or who.get("UniqueName") or ""),
            "name": name,
            "email": who.get("EmailAddress") or "",
        }


class BrightspaceSession:
    def __init__(self, base_url: str, access_token: str) -> None:
        self._base = base_url
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def courses(self) -> list[dict]:
        data = _json_req(f"{self._base}/d2l/api/lp/1.43/enrollments/myenrollments/?orgUnitTypeId=3", self._auth)
        out = []
        for item in data.get("Items", []):
            org = item.get("OrgUnit", {})
            if org.get("Id"):
                out.append({"id": str(org["Id"]), "name": org.get("Name", ""), "section": org.get("Code")})
        return out

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        rows = _json_req(f"{self._base}/d2l/api/le/1.67/{cid}/dropbox/folders/", self._auth)
        return [{"id": str(r["Id"]), "title": r.get("Name", "")} for r in (rows if isinstance(rows, list) else [])]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        data = _json_req(f"{self._base}/d2l/api/lp/1.43/enrollments/orgUnits/{cid}/users/", self._auth)
        out = {}
        for item in data.get("Items", []):
            u = item.get("User", {})
            uid = str(u.get("Identifier", ""))
            if uid:
                out[uid] = u.get("DisplayName") or "Student"
        return out

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        rows = _json_req(f"{self._base}/d2l/api/le/1.67/{cid}/dropbox/folders/{wid}/submissions/", self._auth)
        out = []
        for entry in (rows if isinstance(rows, list) else []):
            entity = entry.get("Entity", {})
            uid = str(entity.get("EntityId", ""))
            files = []
            for sub in entry.get("Submissions", []):
                for f in sub.get("Files", []):
                    fid = str(f.get("FileId", ""))
                    if fid:
                        files.append(
                            {
                                "id": fid,
                                "title": f.get("FileName", ""),
                                "url": f"{self._base}/d2l/api/le/1.67/{cid}/dropbox/folders/{wid}/submissions/{sub['Id']}/files/{fid}",
                            }
                        )
            out.append({"id": uid, "userId": uid, "state": "TURNED_IN" if files else "CREATED", "files": files})
        return out

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        if not file_url:
            raise LmsError("Missing Brightspace file URL")
        data, headers = _call(urllib.request.Request(file_url, headers=self._auth), MAX_DOWNLOAD_BYTES)
        mime = headers.get("content-type", "").split(";")[0].strip().lower()
        if mime not in IMAGE_TYPES:
            raise LmsError("not a photo (JPEG, PNG or WebP)")
        return data, mime

    def sync_grade(
        self,
        course_id: str,
        work_id: str,
        lms_user_id: str,
        submission_id: Optional[str],
        score: float,
        max_score: float,
        feedback: str,
    ) -> None:
        cid, wid, uid = urllib.parse.quote(course_id), urllib.parse.quote(work_id), urllib.parse.quote(lms_user_id)
        folder = _json_req(f"{self._base}/d2l/api/le/1.67/{cid}/dropbox/folders/{wid}", self._auth)
        grade_item_id = folder.get("GradeItemId")
        if grade_item_id:
            pct = (score / max_score * 100.0) if max_score > 0 else 0.0
            _json_req(
                f"{self._base}/d2l/api/le/1.67/{cid}/grades/{grade_item_id}/values/{uid}",
                self._auth,
                method="PUT",
                payload={"PointsNumerator": round(pct, 2), "Comments": {"Content": feedback[:1000], "Type": "Text"}},
            )
        _json_req(
            f"{self._base}/d2l/api/le/1.67/{cid}/dropbox/folders/{wid}/feedback/user/{uid}",
            self._auth,
            method="POST",
            payload={"Score": round(score, 2), "Feedback": {"Content": feedback[:1000], "Type": "Text"}, "IsGraded": True},
        )


# --------------------------------------------------------------------------- Canvas LMS
class CanvasProvider:
    provider_id = "canvas"
    requires_instance_url = True

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, sso_redirect_uri: str = "") -> None:
        self._id = client_id
        self._secret = client_secret
        self._redirect = redirect_uri
        self._sso_redirect = sso_redirect_uri or redirect_uri

    def auth_url(self, state: str, instance_url: Optional[str] = None, sso: bool = False) -> str:
        base = normalize_instance_url(instance_url)
        q = {
            "client_id": self._id,
            "redirect_uri": self._sso_redirect if sso else self._redirect,
            "response_type": "code",
            "state": state,
        }
        return f"{base}/login/oauth2/auth?{urllib.parse.urlencode(q)}"

    def _token(self, base: str, fields: dict) -> dict:
        body = urllib.parse.urlencode(
            {"client_id": self._id, "client_secret": self._secret, **fields}
        ).encode()
        data, _ = _call(urllib.request.Request(f"{base}/login/oauth2/token", data=body, method="POST"))
        return json.loads(data)

    def exchange(self, code: str, instance_url: Optional[str] = None, sso: bool = False) -> dict:
        base = normalize_instance_url(instance_url)
        tok = self._token(
            base,
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self._sso_redirect if sso else self._redirect,
            },
        )
        if not tok.get("access_token"):
            raise LmsError("Canvas did not return an access token")
        return {
            "access_token": tok["access_token"],
            "refresh_token": tok.get("refresh_token", ""),
            "instance_url": base,
        }

    def open(self, token_data: dict) -> "CanvasSession":
        base = normalize_instance_url(token_data.get("instance_url"))
        refresh = token_data.get("refresh_token")
        if refresh:
            tok = self._token(base, {"grant_type": "refresh_token", "refresh_token": refresh})
            access = tok["access_token"]
        else:
            access = token_data["access_token"]
        return CanvasSession(base, access)

    def revoke(self, token_data: dict) -> None:
        base = token_data.get("instance_url")
        access = token_data.get("access_token")
        if base and access:
            try:
                _call(
                    urllib.request.Request(
                        f"{base}/login/oauth2/token",
                        headers={"Authorization": f"Bearer {access}"},
                        method="DELETE",
                    )
                )
            except LmsError:
                pass

    def user_info(self, access_token: str, instance_url: Optional[str] = None) -> dict:
        base = normalize_instance_url(instance_url)
        prof = _json_req(f"{base}/api/v1/users/self/profile", {"Authorization": f"Bearer {access_token}"})
        return {
            "sub": str(prof.get("id", "")),
            "name": prof.get("name") or prof.get("short_name") or "User",
            "email": prof.get("primary_email") or "",
        }


class CanvasSession:
    def __init__(self, base_url: str, access_token: str) -> None:
        self._base = base_url
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def courses(self) -> list[dict]:
        rows = _json_req(f"{self._base}/api/v1/courses?enrollment_type=teacher&state[]=available&per_page=100", self._auth)
        return [{"id": str(c["id"]), "name": c.get("name", ""), "section": c.get("course_code")} for c in rows]

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        rows = _json_req(f"{self._base}/api/v1/courses/{cid}/assignments?per_page=100", self._auth)
        return [{"id": str(a["id"]), "title": a.get("name", "")} for a in rows]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        rows = _json_req(f"{self._base}/api/v1/courses/{cid}/students?per_page=100", self._auth)
        return {str(s["id"]): s.get("name", "Student") for s in rows}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        rows = _json_req(f"{self._base}/api/v1/courses/{cid}/assignments/{wid}/submissions?per_page=100", self._auth)
        out = []
        for s in rows:
            files = [
                {"id": str(a["id"]), "title": a.get("filename", ""), "url": a.get("url", "")}
                for a in s.get("attachments", [])
                if a.get("url")
            ]
            state = "TURNED_IN" if s.get("workflow_state") in ("submitted", "graded", "pending_review") else "CREATED"
            out.append({"id": str(s.get("id", "")), "userId": str(s["user_id"]), "state": state, "files": files})
        return out

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        if not file_url:
            raise LmsError("Missing Canvas attachment URL")
        data, headers = _call(urllib.request.Request(file_url, headers=self._auth), MAX_DOWNLOAD_BYTES)
        mime = headers.get("content-type", "").split(";")[0].strip().lower()
        if mime not in IMAGE_TYPES:
            raise LmsError("not a photo (JPEG, PNG or WebP)")
        return data, mime

    def sync_grade(
        self,
        course_id: str,
        work_id: str,
        lms_user_id: str,
        submission_id: Optional[str],
        score: float,
        max_score: float,
        feedback: str,
    ) -> None:
        cid, wid, uid = urllib.parse.quote(course_id), urllib.parse.quote(work_id), urllib.parse.quote(lms_user_id)
        _json_req(
            f"{self._base}/api/v1/courses/{cid}/assignments/{wid}/submissions/{uid}",
            self._auth,
            method="PUT",
            payload={
                "submission": {"posted_grade": round(score, 2)},
                "comment": {"text_comment": feedback[:1000]},
            },
        )


# --------------------------------------------------------------------------- Microsoft Teams for Education / Entra ID
class MicrosoftEduProvider:
    provider_id = "microsoft_edu"
    requires_instance_url = False
    AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    LMS_SCOPES = "openid profile email offline_access User.Read EduRoster.Read EduAssignments.ReadWrite"
    SSO_SCOPES = "openid profile email User.Read"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, sso_redirect_uri: str = "") -> None:
        self._id = client_id
        self._secret = client_secret
        self._redirect = redirect_uri
        self._sso_redirect = sso_redirect_uri or redirect_uri

    def auth_url(self, state: str, instance_url: Optional[str] = None, sso: bool = False) -> str:
        q = {
            "client_id": self._id,
            "redirect_uri": self._sso_redirect if sso else self._redirect,
            "response_type": "code",
            "scope": self.SSO_SCOPES if sso else self.LMS_SCOPES,
            "response_mode": "query",
            "state": state,
        }
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(q)}"

    def _token(self, fields: dict) -> dict:
        body = urllib.parse.urlencode(
            {"client_id": self._id, "client_secret": self._secret, **fields}
        ).encode()
        data, _ = _call(urllib.request.Request(self.TOKEN_URL, data=body, method="POST"))
        return json.loads(data)

    def exchange(self, code: str, instance_url: Optional[str] = None, sso: bool = False) -> dict:
        tok = self._token(
            {
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self._sso_redirect if sso else self._redirect,
            }
        )
        if not tok.get("access_token"):
            raise LmsError("Microsoft did not return an access token")
        return {
            "access_token": tok["access_token"],
            "refresh_token": tok.get("refresh_token", ""),
        }

    def open(self, token_data: dict) -> "MicrosoftEduSession":
        refresh = token_data.get("refresh_token")
        if refresh:
            tok = self._token(
                {
                    "grant_type": "refresh_token",
                    "refresh_token": refresh,
                    "scope": self.LMS_SCOPES,
                }
            )
            access = tok["access_token"]
        else:
            access = token_data["access_token"]
        return MicrosoftEduSession(access)

    def revoke(self, token_data: dict) -> None:
        pass  # Entra refresh tokens are removed from BirdBrains store

    def user_info(self, access_token: str, instance_url: Optional[str] = None) -> dict:
        me = _json_req("https://graph.microsoft.com/v1.0/me", {"Authorization": f"Bearer {access_token}"})
        return {
            "sub": str(me.get("id", "")),
            "name": me.get("displayName") or "User",
            "email": me.get("mail") or me.get("userPrincipalName") or "",
        }


class MicrosoftEduSession:
    GRAPH = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str) -> None:
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def courses(self) -> list[dict]:
        data = _json_req(f"{self.GRAPH}/education/me/classes", self._auth)
        return [
            {"id": c["id"], "name": c.get("displayName", ""), "section": c.get("classCode")}
            for c in data.get("value", [])
        ]

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/assignments", self._auth)
        return [{"id": a["id"], "title": a.get("displayName", "")} for a in data.get("value", [])]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/members", self._auth)
        return {m["id"]: m.get("displayName", "Student") for m in data.get("value", []) if m.get("primaryRole") == "student"}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions?$expand=resources", self._auth)
        out = []
        for s in data.get("value", []):
            uid = (s.get("submittedBy", {}).get("user") or {}).get("id", "")
            files = []
            for r in s.get("resources", []):
                res = r.get("resource", {})
                file_ref = res.get("file") or {}
                if file_ref.get("odataid"):
                    files.append({"id": r["id"], "title": res.get("displayName", ""), "url": file_ref["odataid"]})
            state = "TURNED_IN" if s.get("status") in ("submitted", "returned") else "CREATED"
            out.append({"id": s["id"], "userId": uid, "state": state, "files": files})
        return out

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        if not file_url:
            raise LmsError("Missing Microsoft Graph resource URL")
        data, headers = _call(urllib.request.Request(f"{file_url}/content", headers=self._auth), MAX_DOWNLOAD_BYTES)
        mime = headers.get("content-type", "").split(";")[0].strip().lower()
        if mime not in IMAGE_TYPES:
            raise LmsError("not a photo (JPEG, PNG or WebP)")
        return data, mime

    def sync_grade(
        self,
        course_id: str,
        work_id: str,
        lms_user_id: str,
        submission_id: Optional[str],
        score: float,
        max_score: float,
        feedback: str,
    ) -> None:
        if not submission_id:
            raise LmsError("Missing Microsoft submission ID")
        cid, wid, sid = urllib.parse.quote(course_id), urllib.parse.quote(work_id), urllib.parse.quote(submission_id)
        outcomes = _json_req(
            f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions/{sid}/outcomes",
            self._auth,
        ).get("value", [])
        points_outcome = next((o for o in outcomes if "pointsOutcome" in o.get("@odata.type", "")), None)
        if points_outcome:
            _json_req(
                f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions/{sid}/outcomes/{points_outcome['id']}",
                self._auth,
                method="PATCH",
                payload={"points": {"points": round(score, 2)}},
            )
        feedback_outcome = next((o for o in outcomes if "feedbackOutcome" in o.get("@odata.type", "")), None)
        if feedback_outcome:
            _json_req(
                f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions/{sid}/outcomes/{feedback_outcome['id']}",
                self._auth,
                method="PATCH",
                payload={"feedback": {"text": {"content": feedback[:1000], "contentType": "text"}}},
            )
