"""School LMS integrations: Canvas, Brightspace (D2L) and Microsoft Teams for Education.

Teachers connect with OAuth2 and import the photos students handed in; anyone at a
school that has set Quark up can also sign in with their LMS account.

Canvas and Brightspace are set up **per school**. Each school's LMS admin creates
the OAuth app on their own site (Canvas: Admin > Developer Keys > + API Key;
Brightspace: Admin Tools > Manage Extensibility > OAuth 2.0 > Register an app) and
gives Quark the client ID and secret. Those are kept in the ``lmsschools``
collection, sealed (see :class:`Sealer`), and Quark only ever talks to the LMS
addresses listed there. That also means a typed-in address can never make the API
send a client secret to a server we have not checked.

Microsoft is one multi-tenant app, configured from environment variables.

Plain HTTPS calls (urllib); no OAuth client library needed.
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Protocol

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
MAX_PAGES = 50  # 50 pages of 100: far more than any one class

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
# Providers whose OAuth app belongs to each school (credentials in ``lmsschools``).
SCHOOL_PROVIDERS = ("brightspace", "canvas")


class LmsError(Exception):
    pass


def normalize_instance_url(url: Optional[str]) -> str:
    """Validate and normalize a school's LMS base URL (HTTPS only)."""
    if not url or not url.strip():
        raise LmsError("School LMS URL is required")
    raw = url.strip()
    if "://" not in raw:
        raw = "https://" + raw  # people often type just the address
    parsed = urllib.parse.urlparse(raw.rstrip("/"))
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise LmsError("School LMS URL must start with https://")
    host = (parsed.hostname or "").lower()
    if (host in ("localhost", "0.0.0.0", "::1") or "." not in host
            or re.fullmatch(r"[\d.]+", host) or host.startswith("[")):
        raise LmsError("Invalid school LMS host")
    port = f":{parsed.port}" if parsed.port and parsed.port != 443 else ""
    return f"https://{host}{port}"


def school_key(provider_id: str, instance_url: str) -> str:
    """Firestore id of a school's LMS set-up, e.g. ``canvas:school.instructure.com``."""
    return f"{provider_id}:{urllib.parse.urlparse(instance_url).netloc}"


def sso_uid(provider_id: str, instance_url: Optional[str], sub: str) -> str:
    """Firebase uid for someone signing in with their LMS. LMS user ids are only
    unique within one school's site, so the site is part of the uid (hashed, to
    keep it short)."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", sub)[:64]
    if not instance_url:  # one app-wide provider (Microsoft): its ids are already global
        return f"lms_{provider_id}_{safe}"
    site = hashlib.sha256(instance_url.encode()).hexdigest()[:12]
    return f"lms_{provider_id}_{site}_{safe}"


def _expiry(tok: dict) -> str:
    secs = int(tok.get("expires_in") or 3600)
    return (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat()


def expired(token_data: dict, margin: int = 120) -> bool:
    at = token_data.get("expires_at")
    if not at:
        return True
    return datetime.fromisoformat(at) - timedelta(seconds=margin) <= datetime.now(timezone.utc)


# --------------------------------------------------------------------------- sealing
class Sealer:
    """Encrypts what Quark stores for the LMS: schools' client secrets and teachers'
    tokens. The key (BIRDBRAINS_LMS_KEY, a Fernet key in Secret Manager) never
    leaves the API, so a copy of the database alone cannot use them."""

    def __init__(self, key: str) -> None:
        from cryptography.fernet import Fernet

        self._f = Fernet(key.encode() if isinstance(key, str) else key)

    @staticmethod
    def new_key() -> str:
        from cryptography.fernet import Fernet

        return Fernet.generate_key().decode()

    def seal(self, data: dict) -> str:
        return self._f.encrypt(json.dumps(data).encode()).decode()

    def unseal(self, sealed: str) -> dict:
        from cryptography.fernet import InvalidToken

        try:
            return json.loads(self._f.decrypt(sealed.encode()))
        except (InvalidToken, ValueError):
            raise LmsError("stored LMS data could not be read") from None


# --------------------------------------------------------------------------- protocols
class LmsSession(Protocol):
    def courses(self) -> list[dict]:
        """[{id, name, section}] for courses the person teaches."""

    def assignments(self, course_id: str) -> list[dict]:
        """[{id, title}]"""

    def student_names(self, course_id: str) -> dict[str, str]:
        """{lms_user_id: full_name}"""

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        """[{id, userId, state, files: [{id, title, url}]}]"""

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        """(bytes, mime_type). Raises LmsError if not a supported image."""

    def sync_grade(self, course_id: str, work_id: str, lms_user_id: str, submission_id: Optional[str],
                   score: float, max_score: float, feedback: str) -> None:
        """Push grade and feedback back to the LMS."""


class LmsProvider(Protocol):
    provider_id: str
    requires_instance_url: bool
    instance_url: Optional[str]

    def auth_url(self, state: str, sso: bool = False) -> str: ...

    def exchange(self, code: str, sso: bool = False) -> dict:
        """Authorization code -> token data {access_token, refresh_token, expires_at, ...}."""

    def refresh(self, token_data: dict) -> dict:
        """New token data. Brightspace and Microsoft hand out a new refresh token
        each time and the old one stops working, so the caller must store the result."""

    def session(self, token_data: dict) -> LmsSession: ...

    def revoke(self, token_data: dict) -> None: ...

    def user_info(self, token_data: dict) -> dict:
        """{sub, name, email} for signing in."""


# (provider_id, school record with clientId/clientSecret/instanceUrl) -> provider
LmsFactory = Callable[[str, dict], LmsProvider]


# --------------------------------------------------------------------------- HTTP
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


def _form_post(url: str, fields: dict) -> dict:
    body = urllib.parse.urlencode(fields).encode()
    data, _ = _call(urllib.request.Request(url, data=body, method="POST",
                                           headers={"Content-Type": "application/x-www-form-urlencoded"}))
    return json.loads(data)


def _download(url: str, access_token: str) -> tuple[bytes, str]:
    # Canvas file links redirect to a storage server that rejects a second
    # credential; urllib leaves unredirected headers off the redirected request.
    req = urllib.request.Request(url)
    req.add_unredirected_header("Authorization", f"Bearer {access_token}")
    data, headers = _call(req, MAX_DOWNLOAD_BYTES)
    mime = headers.get("content-type", "").split(";")[0].strip().lower()
    if mime not in IMAGE_TYPES:
        raise LmsError("not a photo (JPEG, PNG or WebP)")
    return data, mime


def _next_link(headers: dict) -> Optional[str]:
    """The rel="next" URL from a Link header (Canvas pagination)."""
    for part in headers.get("link", "").split(","):
        bits = part.split(";")
        if len(bits) > 1 and any(b.strip() == 'rel="next"' for b in bits[1:]):
            return bits[0].strip().strip("<>")
    return None


def _same_site(url: str, base: str) -> bool:
    return urllib.parse.urlparse(url).netloc == urllib.parse.urlparse(base).netloc


# --------------------------------------------------------------------------- Brightspace (D2L)
class BrightspaceProvider:
    """Brightspace's OAuth service is shared (auth.brightspace.com), but each school
    registers its own app, so the client ID and secret are the school's."""

    provider_id = "brightspace"
    requires_instance_url = True
    AUTH_URL = "https://auth.brightspace.com/oauth2/auth"
    TOKEN_URL = "https://auth.brightspace.com/core/connect/token"
    # The school's admin ticks exactly these when registering the app (docs/LMS.md).
    LMS_SCOPES = ("enrollment:own_enrollment:read enrollment:orgunit:read "
                  "dropbox:folders:read dropbox:folders:write users:own_profile:read")
    SSO_SCOPES = "users:own_profile:read"
    LP, LE = "1.43", "1.67"  # API versions every supported Brightspace release has

    def __init__(self, client_id: str, client_secret: str, instance_url: str, redirect_uri: str,
                 sso_redirect_uri: str) -> None:
        self._id, self._secret = client_id, client_secret
        self.instance_url = normalize_instance_url(instance_url)
        self._redirect, self._sso_redirect = redirect_uri, sso_redirect_uri

    def auth_url(self, state: str, sso: bool = False) -> str:
        q = {"client_id": self._id, "redirect_uri": self._sso_redirect if sso else self._redirect,
             "response_type": "code", "scope": self.SSO_SCOPES if sso else self.LMS_SCOPES, "state": state}
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(q)}"

    def _token(self, fields: dict) -> dict:
        tok = _form_post(self.TOKEN_URL, {"client_id": self._id, "client_secret": self._secret, **fields})
        if not tok.get("access_token"):
            raise LmsError("Brightspace did not return an access token")
        return {"access_token": tok["access_token"], "refresh_token": tok.get("refresh_token", ""),
                "expires_at": _expiry(tok), "instance_url": self.instance_url}

    def exchange(self, code: str, sso: bool = False) -> dict:
        return self._token({"code": code, "grant_type": "authorization_code",
                            "redirect_uri": self._sso_redirect if sso else self._redirect})

    def refresh(self, token_data: dict) -> dict:
        if not token_data.get("refresh_token"):
            raise LmsError("no refresh token (the school's app needs 'Enable refresh tokens')")
        # Single use: the old refresh token stops working once this returns.
        return self._token({"refresh_token": token_data["refresh_token"], "grant_type": "refresh_token",
                            "scope": self.LMS_SCOPES})

    def session(self, token_data: dict) -> "BrightspaceSession":
        return BrightspaceSession(self.instance_url, token_data["access_token"], self.LP, self.LE)

    def revoke(self, token_data: dict) -> None:
        pass  # Brightspace has no revoke endpoint; the tokens are deleted and expire

    def user_info(self, token_data: dict) -> dict:
        who = _json_req(f"{self.instance_url}/d2l/api/lp/{self.LP}/users/whoami",
                        {"Authorization": f"Bearer {token_data['access_token']}"})
        name = " ".join(p for p in (who.get("FirstName"), who.get("LastName")) if p).strip()
        sub = str(who.get("Identifier") or "")
        if not sub:
            raise LmsError("Brightspace did not say who signed in")
        return {"sub": sub, "name": name or who.get("UniqueName") or "", "email": ""}


class BrightspaceSession:
    def __init__(self, base_url: str, access_token: str, lp: str = BrightspaceProvider.LP,
                 le: str = BrightspaceProvider.LE) -> None:
        self._base, self._token = base_url, access_token
        self._auth = {"Authorization": f"Bearer {access_token}"}
        self._lp, self._le = f"{base_url}/d2l/api/lp/{lp}", f"{base_url}/d2l/api/le/{le}"

    def _paged(self, url: str) -> list[dict]:
        """Follow a PagedResultSet's bookmarks."""
        out, bookmark = [], None
        for _ in range(MAX_PAGES):
            sep = "&" if "?" in url else "?"
            page = _json_req(url + (f"{sep}bookmark={urllib.parse.quote(bookmark)}" if bookmark else ""), self._auth)
            out += page.get("Items", [])
            info = page.get("PagingInfo") or {}
            bookmark = info.get("Bookmark")
            if not info.get("HasMoreItems") or not bookmark:
                break
        return out

    def courses(self) -> list[dict]:
        out = []
        for item in self._paged(f"{self._lp}/enrollments/myenrollments/?orgUnitTypeId=3"):
            org = item.get("OrgUnit", {})
            access = item.get("Access") or {}
            if org.get("Id") and access.get("IsActive", True):
                out.append({"id": str(org["Id"]), "name": org.get("Name", ""), "section": org.get("Code")})
        return out

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        rows = _json_req(f"{self._le}/{cid}/dropbox/folders/", self._auth)
        return [{"id": str(r["Id"]), "title": r.get("Name", "")} for r in (rows if isinstance(rows, list) else [])]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        out = {}
        for item in self._paged(f"{self._lp}/enrollments/orgUnits/{cid}/users/"):
            u = item.get("User", {})
            uid = str(u.get("Identifier", ""))
            if uid:
                out[uid] = u.get("DisplayName") or "Student"
        return out

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        rows = _json_req(f"{self._le}/{cid}/dropbox/folders/{wid}/submissions/", self._auth)
        out = []
        for entry in (rows if isinstance(rows, list) else []):
            entity = entry.get("Entity", {})
            if entity.get("EntityType", "User") != "User":
                continue  # group hand-ins have no one student to grade
            uid = str(entity.get("EntityId", ""))
            subs = entry.get("Submissions") or []
            latest = subs[-1] if subs else None  # oldest first; the last is what they handed in last
            files = []
            for f in (latest or {}).get("Files", []):
                fid = str(f.get("FileId", ""))
                if fid:
                    files.append({"id": fid, "title": f.get("FileName", ""),
                                  "url": f"{self._le}/{cid}/dropbox/folders/{wid}/submissions/"
                                         f"{latest['Id']}/files/{fid}"})
            out.append({"id": str(latest["Id"]) if latest else uid, "userId": uid,
                        "state": "TURNED_IN" if latest else "CREATED", "files": files})
        return out

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        if not file_url or not _same_site(file_url, self._base):
            raise LmsError("Missing Brightspace file URL")
        return _download(file_url, self._token)

    def sync_grade(self, course_id: str, work_id: str, lms_user_id: str, submission_id: Optional[str],
                   score: float, max_score: float, feedback: str) -> None:
        """Saves the score (scaled to the folder's 'out of') and feedback on the
        assignment. Brightspace keeps it as draft feedback until the teacher
        publishes it there, so the teacher still decides what students see."""
        cid, wid, uid = (urllib.parse.quote(x) for x in (course_id, work_id, lms_user_id))
        folder = _json_req(f"{self._le}/{cid}/dropbox/folders/{wid}", self._auth)
        out_of = ((folder.get("Assessment") or {}).get("ScoreDenominator")) or max_score or 0
        scaled = (score / max_score * out_of) if max_score > 0 else 0.0
        _json_req(f"{self._le}/{cid}/dropbox/folders/{wid}/feedback/user/{uid}", self._auth, method="POST",
                  payload={"Score": round(scaled, 2), "Feedback": {"Content": feedback[:1000], "Type": "Text"},
                           "RubricAssessments": [], "IsGraded": True})


# --------------------------------------------------------------------------- Canvas LMS
class CanvasProvider:
    provider_id = "canvas"
    requires_instance_url = True
    # Asked for only when the school's developer key has "Enforce scopes" on (we ask
    # admins to turn it on and tick exactly these; see docs/LMS.md).
    SCOPES = (
        "url:GET|/api/v1/courses",
        "url:GET|/api/v1/courses/:course_id/assignments",
        "url:GET|/api/v1/courses/:course_id/users",
        "url:GET|/api/v1/courses/:course_id/assignments/:assignment_id/submissions",
        "url:PUT|/api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id",
        "url:GET|/api/v1/users/:user_id/profile",
    )

    def __init__(self, client_id: str, client_secret: str, instance_url: str, redirect_uri: str,
                 sso_redirect_uri: str, scoped: bool = True) -> None:
        self._id, self._secret = client_id, client_secret
        self.instance_url = normalize_instance_url(instance_url)
        self._redirect, self._sso_redirect = redirect_uri, sso_redirect_uri
        self._scoped = scoped

    def auth_url(self, state: str, sso: bool = False) -> str:
        q = {"client_id": self._id, "redirect_uri": self._sso_redirect if sso else self._redirect,
             "response_type": "code", "state": state}
        if self._scoped:
            q["scope"] = " ".join(self.SCOPES[-1:] if sso else self.SCOPES)
        if sso:
            q["purpose"] = "Quark sign-in"  # shown on the person's Canvas access tokens list
        return f"{self.instance_url}/login/oauth2/auth?{urllib.parse.urlencode(q)}"

    def _token(self, fields: dict) -> dict:
        tok = _form_post(f"{self.instance_url}/login/oauth2/token",
                         {"client_id": self._id, "client_secret": self._secret, **fields})
        if not tok.get("access_token"):
            raise LmsError("Canvas did not return an access token")
        out = {"access_token": tok["access_token"], "refresh_token": tok.get("refresh_token", ""),
               "expires_at": _expiry(tok), "instance_url": self.instance_url}
        if isinstance(tok.get("user"), dict):
            out["user"] = {"id": str(tok["user"].get("id", "")), "name": tok["user"].get("name", "")}
        return out

    def exchange(self, code: str, sso: bool = False) -> dict:
        return self._token({"grant_type": "authorization_code", "code": code,
                            "redirect_uri": self._sso_redirect if sso else self._redirect})

    def refresh(self, token_data: dict) -> dict:
        if not token_data.get("refresh_token"):
            raise LmsError("no refresh token")
        new = self._token({"grant_type": "refresh_token", "refresh_token": token_data["refresh_token"]})
        new["refresh_token"] = new["refresh_token"] or token_data["refresh_token"]  # Canvas keeps the same one
        return new

    def session(self, token_data: dict) -> "CanvasSession":
        return CanvasSession(self.instance_url, token_data["access_token"])

    def revoke(self, token_data: dict) -> None:
        """Deletes the token (and its refresh token) on the school's Canvas."""
        if not token_data.get("access_token"):
            return
        for attempt in range(2):
            try:
                _call(urllib.request.Request(f"{self.instance_url}/login/oauth2/token", method="DELETE",
                                             headers={"Authorization": f"Bearer {token_data['access_token']}"}))
                return
            except LmsError:
                if attempt or not token_data.get("refresh_token"):
                    return
                try:  # the access token may have run out: get a fresh one and try again
                    token_data = self.refresh(token_data)
                except LmsError:
                    return

    def user_info(self, token_data: dict) -> dict:
        user = token_data.get("user") or {}
        if user.get("id"):
            return {"sub": user["id"], "name": user.get("name", ""), "email": ""}
        prof = _json_req(f"{self.instance_url}/api/v1/users/self/profile",
                         {"Authorization": f"Bearer {token_data['access_token']}"})
        if not prof.get("id"):
            raise LmsError("Canvas did not say who signed in")
        return {"sub": str(prof["id"]), "name": prof.get("name") or prof.get("short_name") or "",
                "email": prof.get("primary_email") or ""}


class CanvasSession:
    def __init__(self, base_url: str, access_token: str) -> None:
        self._base, self._token = base_url, access_token
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def _pages(self, url: str) -> list[dict]:
        out: list[dict] = []
        for _ in range(MAX_PAGES):
            data, headers = _call(urllib.request.Request(url, headers=self._auth))
            rows = json.loads(data) if data else []
            out += rows if isinstance(rows, list) else []
            url = _next_link(headers) or ""
            if not url or not _same_site(url, self._base):
                break
        return out

    def courses(self) -> list[dict]:
        rows = self._pages(f"{self._base}/api/v1/courses?enrollment_type=teacher"
                           f"&state[]=available&state[]=unpublished&per_page=100")
        return [{"id": str(c["id"]), "name": c.get("name", ""), "section": c.get("course_code")}
                for c in rows if c.get("id")]

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        rows = self._pages(f"{self._base}/api/v1/courses/{cid}/assignments?per_page=100")
        return [{"id": str(a["id"]), "title": a.get("name", "")} for a in rows]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        rows = self._pages(f"{self._base}/api/v1/courses/{cid}/users?enrollment_type[]=student&per_page=100")
        return {str(s["id"]): s.get("name") or "Student" for s in rows}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        rows = self._pages(f"{self._base}/api/v1/courses/{cid}/assignments/{wid}/submissions?per_page=100")
        out = []
        for s in rows:
            files = [{"id": str(a["id"]), "title": a.get("filename", ""), "url": a["url"]}
                     for a in s.get("attachments") or []
                     if a.get("url") and (a.get("content-type") or "image/").startswith("image/")]
            state = "TURNED_IN" if s.get("workflow_state") in ("submitted", "graded", "pending_review") else "CREATED"
            out.append({"id": str(s.get("id", "")), "userId": str(s["user_id"]), "state": state, "files": files})
        return out

    def download(self, file_id: str, file_url: Optional[str] = None) -> tuple[bytes, str]:
        if not file_url or not _same_site(file_url, self._base):
            raise LmsError("Missing Canvas attachment URL")
        return _download(file_url, self._token)

    def sync_grade(self, course_id: str, work_id: str, lms_user_id: str, submission_id: Optional[str],
                   score: float, max_score: float, feedback: str) -> None:
        """Posted as a percentage, so Canvas scales it to the assignment's points."""
        cid, wid, uid = (urllib.parse.quote(x) for x in (course_id, work_id, lms_user_id))
        pct = (score / max_score * 100.0) if max_score > 0 else 0.0
        _json_req(f"{self._base}/api/v1/courses/{cid}/assignments/{wid}/submissions/{uid}", self._auth,
                  method="PUT", payload={"submission": {"posted_grade": f"{pct:.2f}%"},
                                         "comment": {"text_comment": feedback[:1000]}})


def school_provider(provider_id: str, school: dict, public_url: str) -> LmsProvider:
    """Build the provider for one school from its record (secret already unsealed)."""
    # Connecting and signing in share one redirect URI (Brightspace allows only one).
    callback = f"{public_url.rstrip('/')}/lms/{provider_id}/callback"
    args = (school["clientId"], school["clientSecret"], school["instanceUrl"], callback, callback)
    if provider_id == "canvas":
        return CanvasProvider(*args, scoped=school.get("scoped", True))
    if provider_id == "brightspace":
        return BrightspaceProvider(*args)
    raise LmsError(f"{provider_id} is not set up per school")


# --------------------------------------------------------------------------- Microsoft Teams for Education / Entra ID
class MicrosoftEduProvider:
    provider_id = "microsoft_edu"
    requires_instance_url = False
    instance_url = None
    AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    LMS_SCOPES = "openid profile email offline_access User.Read EduRoster.Read EduAssignments.ReadWrite"
    SSO_SCOPES = "openid profile email User.Read"

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, sso_redirect_uri: str = "") -> None:
        self._id = client_id
        self._secret = client_secret
        self._redirect = redirect_uri
        self._sso_redirect = sso_redirect_uri or redirect_uri

    def auth_url(self, state: str, sso: bool = False) -> str:
        q = {"client_id": self._id, "redirect_uri": self._sso_redirect if sso else self._redirect,
             "response_type": "code", "scope": self.SSO_SCOPES if sso else self.LMS_SCOPES,
             "response_mode": "query", "state": state}
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(q)}"

    def _token(self, fields: dict) -> dict:
        tok = _form_post(self.TOKEN_URL, {"client_id": self._id, "client_secret": self._secret, **fields})
        if not tok.get("access_token"):
            raise LmsError("Microsoft did not return an access token")
        return {"access_token": tok["access_token"], "refresh_token": tok.get("refresh_token", ""),
                "expires_at": _expiry(tok)}

    def exchange(self, code: str, sso: bool = False) -> dict:
        return self._token({"code": code, "grant_type": "authorization_code",
                            "redirect_uri": self._sso_redirect if sso else self._redirect})

    def refresh(self, token_data: dict) -> dict:
        if not token_data.get("refresh_token"):
            raise LmsError("no refresh token")
        new = self._token({"grant_type": "refresh_token", "refresh_token": token_data["refresh_token"],
                           "scope": self.LMS_SCOPES})
        new["refresh_token"] = new["refresh_token"] or token_data["refresh_token"]
        return new

    def session(self, token_data: dict) -> "MicrosoftEduSession":
        return MicrosoftEduSession(token_data["access_token"])

    def revoke(self, token_data: dict) -> None:
        pass  # Entra refresh tokens are removed from the Quark store

    def user_info(self, token_data: dict) -> dict:
        me = _json_req("https://graph.microsoft.com/v1.0/me", {"Authorization": f"Bearer {token_data['access_token']}"})
        return {"sub": str(me.get("id", "")), "name": me.get("displayName") or "",
                "email": me.get("mail") or me.get("userPrincipalName") or ""}


class MicrosoftEduSession:
    GRAPH = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str) -> None:
        self._token = access_token
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def courses(self) -> list[dict]:
        data = _json_req(f"{self.GRAPH}/education/me/classes", self._auth)
        return [{"id": c["id"], "name": c.get("displayName", ""), "section": c.get("classCode")}
                for c in data.get("value", [])]

    def assignments(self, course_id: str) -> list[dict]:
        cid = urllib.parse.quote(course_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/assignments", self._auth)
        return [{"id": a["id"], "title": a.get("displayName", "")} for a in data.get("value", [])]

    def student_names(self, course_id: str) -> dict[str, str]:
        cid = urllib.parse.quote(course_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/members", self._auth)
        return {m["id"]: m.get("displayName", "Student") for m in data.get("value", [])
                if m.get("primaryRole") == "student"}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        cid, wid = urllib.parse.quote(course_id), urllib.parse.quote(work_id)
        data = _json_req(f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions?$expand=resources",
                         self._auth)
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
        if not file_url or not file_url.startswith("https://graph.microsoft.com/"):
            raise LmsError("Missing Microsoft Graph resource URL")
        return _download(f"{file_url}/content", self._token)

    def sync_grade(self, course_id: str, work_id: str, lms_user_id: str, submission_id: Optional[str],
                   score: float, max_score: float, feedback: str) -> None:
        if not submission_id:
            raise LmsError("Missing Microsoft submission ID")
        cid, wid, sid = urllib.parse.quote(course_id), urllib.parse.quote(work_id), urllib.parse.quote(submission_id)
        base = f"{self.GRAPH}/education/classes/{cid}/assignments/{wid}/submissions/{sid}/outcomes"
        outcomes = _json_req(base, self._auth).get("value", [])
        points = next((o for o in outcomes if "pointsOutcome" in o.get("@odata.type", "")), None)
        if points:
            _json_req(f"{base}/{points['id']}", self._auth, method="PATCH",
                      payload={"points": {"points": round(score, 2)}})
        fb = next((o for o in outcomes if "feedbackOutcome" in o.get("@odata.type", "")), None)
        if fb:
            _json_req(f"{base}/{fb['id']}", self._auth, method="PATCH",
                      payload={"feedback": {"text": {"content": feedback[:1000], "contentType": "text"}}})
