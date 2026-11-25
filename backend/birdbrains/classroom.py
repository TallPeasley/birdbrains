"""Google Classroom (Pro, teacher accounts): OAuth connect and reading courses,
assignments and the image files students handed in.

Scopes are read-only. ``drive.readonly`` is needed to download the attachments
students turn in (they are Drive files); Google classes it as a *restricted*
scope, so outside test users the OAuth app needs Google's verification.

Plain HTTPS calls (urllib); no Google client library needed.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Protocol

SCOPES = (
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
)
# A student connecting their own Classroom: their classes, the assignments set in
# them (with the teacher's instructions and rubric) and their own grades. Both are
# "sensitive", not restricted, scopes: no yearly security assessment for these.
STUDENT_SCOPES = (
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
)
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024


class ClassroomError(Exception):
    pass


class ClassroomSession(Protocol):
    def courses(self) -> list[dict]:
        """[{id, name, section}] for courses the teacher teaches (active only)."""

    def coursework(self, course_id: str) -> list[dict]:
        """[{id, title}]"""

    def student_names(self, course_id: str) -> dict[str, str]:
        """{google user id: full name}"""

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        """[{userId, state, files: [{id, title}]}] (Drive attachments only)"""

    def download(self, file_id: str) -> tuple[bytes, str]:
        """(bytes, mime type). Raises ClassroomError if it is not a supported image."""

    # Student side (STUDENT_SCOPES)
    def my_courses(self) -> list[dict]:
        """[{id, name, section}] for courses the student is enrolled in (active only)."""

    def my_work(self, course_id: str) -> list[dict]:
        """Assignments in one course with the student's own submission:
        [{id, title, description, maxPoints, dueDate, link, state, assignedGrade, rubric}]
        where rubric is [{title, description, levels: [{title, points}]}] or []."""


class Classroom(Protocol):
    def auth_url(self, state: str, scopes: tuple[str, ...] = SCOPES) -> str: ...

    def exchange(self, code: str) -> str:
        """Authorization code -> refresh token."""

    def open(self, refresh_token: str) -> ClassroomSession: ...

    def revoke(self, refresh_token: str) -> None: ...


def _call(req: urllib.request.Request, limit: Optional[int] = None) -> bytes:
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read((limit or 50_000_000) + 1)
    except urllib.error.HTTPError as e:
        raise ClassroomError(f"Google returned {e.code}") from None
    except OSError as e:
        raise ClassroomError(f"Google unreachable: {e}") from None
    if limit and len(data) > limit:
        raise ClassroomError("file too large")
    return data


class GoogleClassroom:
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self._id, self._secret, self._redirect = client_id, client_secret, redirect_uri

    def auth_url(self, state: str, scopes: tuple[str, ...] = SCOPES) -> str:
        q = {"client_id": self._id, "redirect_uri": self._redirect, "response_type": "code",
             "scope": " ".join(scopes), "access_type": "offline", "prompt": "consent", "state": state}
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(q)

    def _token(self, fields: dict) -> dict:
        body = urllib.parse.urlencode({"client_id": self._id, "client_secret": self._secret, **fields}).encode()
        return json.loads(_call(urllib.request.Request("https://oauth2.googleapis.com/token", data=body, method="POST")))

    def exchange(self, code: str) -> str:
        tok = self._token({"code": code, "grant_type": "authorization_code", "redirect_uri": self._redirect})
        if not tok.get("refresh_token"):
            raise ClassroomError("Google did not return a refresh token")
        return tok["refresh_token"]

    def open(self, refresh_token: str) -> "GoogleSession":
        tok = self._token({"refresh_token": refresh_token, "grant_type": "refresh_token"})
        return GoogleSession(tok["access_token"])

    def revoke(self, refresh_token: str) -> None:
        body = urllib.parse.urlencode({"token": refresh_token}).encode()
        try:
            _call(urllib.request.Request("https://oauth2.googleapis.com/revoke", data=body, method="POST"))
        except ClassroomError:
            pass  # already revoked or expired: nothing left to undo


class GoogleSession:
    API = "https://classroom.googleapis.com/v1"

    def __init__(self, access_token: str) -> None:
        self._auth = {"Authorization": f"Bearer {access_token}"}

    def _pages(self, url: str, key: str, params: Optional[dict] = None) -> list[dict]:
        out, token = [], None
        while True:
            q = dict(params or {}, pageSize=100, **({"pageToken": token} if token else {}))
            data = json.loads(_call(urllib.request.Request(f"{url}?{urllib.parse.urlencode(q)}", headers=self._auth)))
            out += data.get(key, [])
            token = data.get("nextPageToken")
            if not token:
                return out

    def courses(self) -> list[dict]:
        rows = self._pages(f"{self.API}/courses", "courses", {"teacherId": "me", "courseStates": "ACTIVE"})
        return [{"id": c["id"], "name": c.get("name", ""), "section": c.get("section")} for c in rows]

    def coursework(self, course_id: str) -> list[dict]:
        rows = self._pages(f"{self.API}/courses/{urllib.parse.quote(course_id)}/courseWork", "courseWork")
        return [{"id": w["id"], "title": w.get("title", "")} for w in rows]

    def student_names(self, course_id: str) -> dict[str, str]:
        rows = self._pages(f"{self.API}/courses/{urllib.parse.quote(course_id)}/students", "students")
        return {s["userId"]: s.get("profile", {}).get("name", {}).get("fullName", "Student") for s in rows}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        url = (f"{self.API}/courses/{urllib.parse.quote(course_id)}/courseWork/"
               f"{urllib.parse.quote(work_id)}/studentSubmissions")
        out = []
        for s in self._pages(url, "studentSubmissions"):
            files = [{"id": a["driveFile"]["id"], "title": a["driveFile"].get("title", "")}
                     for a in s.get("assignmentSubmission", {}).get("attachments", []) if "driveFile" in a]
            out.append({"id": s["id"], "userId": s["userId"], "state": s.get("state"), "files": files})
        return out

    def my_courses(self) -> list[dict]:
        rows = self._pages(f"{self.API}/courses", "courses", {"studentId": "me", "courseStates": "ACTIVE"})
        return [{"id": c["id"], "name": c.get("name", ""), "section": c.get("section")} for c in rows]

    def my_work(self, course_id: str) -> list[dict]:
        base = f"{self.API}/courses/{urllib.parse.quote(course_id)}/courseWork"
        work = self._pages(base, "courseWork")
        mine = {s["courseWorkId"]: s for s in self._pages(f"{base}/-/studentSubmissions", "studentSubmissions",
                                                          {"userId": "me"})}
        out = []
        for w in work:
            sub = mine.get(w["id"], {})
            due = w.get("dueDate")
            out.append({
                "id": w["id"], "title": w.get("title", ""), "description": w.get("description", ""),
                "maxPoints": w.get("maxPoints"),
                "dueDate": f"{due['year']:04d}-{due['month']:02d}-{due['day']:02d}" if due else None,
                "link": w.get("alternateLink"), "state": sub.get("state"),
                "assignedGrade": sub.get("assignedGrade"), "rubric": self._rubric(base, w["id"]),
            })
        return out

    def _rubric(self, base: str, work_id: str) -> list[dict]:
        """The teacher's rubric, if there is one. Rubrics are not on every school's
        plan, so any error just means no rubric."""
        try:
            rows = self._pages(f"{base}/{urllib.parse.quote(work_id)}/rubrics", "rubrics")
        except ClassroomError:
            return []
        return [{"title": c.get("title", ""), "description": c.get("description", ""),
                 "levels": [{"title": lv.get("title", ""), "points": lv.get("points")} for lv in c.get("levels", [])]}
                for r in rows[:1] for c in r.get("criteria", [])]

    def download(self, file_id: str) -> tuple[bytes, str]:
        base = f"https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}"
        meta = json.loads(_call(urllib.request.Request(f"{base}?fields=mimeType,size", headers=self._auth)))
        if meta.get("mimeType") not in IMAGE_TYPES:
            raise ClassroomError("not a photo (JPEG, PNG or WebP)")
        return _call(urllib.request.Request(f"{base}?alt=media", headers=self._auth), MAX_DOWNLOAD_BYTES), meta["mimeType"]


def expectations_text(work: dict, limit: int = 3000) -> str:
    """The teacher's side of an assignment, for the grading prompt: title, points,
    instructions and rubric. Never the student's name or grade."""
    parts = [f"Assignment: {work.get('title', '')}"]
    if work.get("maxPoints"):
        parts.append(f"Out of {work['maxPoints']:g} points")
    if (work.get("description") or "").strip():
        parts.append("Instructions: " + work["description"].strip())
    for c in work.get("rubric") or []:
        levels = "; ".join(f"{lv['title']} {lv['points']:g}" if lv.get("points") is not None else lv["title"]
                           for lv in c.get("levels", []))
        parts.append(f"Rubric - {c['title']}: {c.get('description', '')}" + (f" ({levels})" if levels else ""))
    return "\n".join(parts)[:limit]
