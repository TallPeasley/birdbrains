import json
from datetime import datetime, timedelta, timezone

import pytest

from conftest import auth, photo
from birdbrains import lms
from birdbrains.lms import (BrightspaceProvider, CanvasProvider, LmsError, Sealer, normalize_instance_url,
                            school_provider, sso_uid)

SCHOOL = "https://board.brightspace.com"


class FakeLmsProvider:
    """One school's provider. Records what the API asks of it."""

    def __init__(self, provider_id: str, school: dict, log: dict):
        self.provider_id = provider_id
        self.requires_instance_url = True
        self.instance_url = school["instanceUrl"]
        self.school = school
        self.log = log
        self.pages = {"f_ada": photo()}

    def auth_url(self, state: str, sso: bool = False) -> str:
        return f"{self.instance_url}/oauth?state={state}&sso={int(sso)}"

    def _tok(self, n: int, life: int = 3600) -> dict:
        at = (datetime.now(timezone.utc) + timedelta(seconds=life)).isoformat()
        return {"access_token": f"acc-{n}", "refresh_token": f"ref-{n}", "expires_at": at,
                "instance_url": self.instance_url}

    def exchange(self, code: str, sso: bool = False) -> dict:
        if code != "good":
            raise LmsError("bad code")
        return self._tok(1, self.log.get("life", 3600))

    def refresh(self, token_data: dict) -> dict:
        self.log.setdefault("refreshed", []).append(token_data["refresh_token"])
        if token_data["refresh_token"] in self.log.get("used", set()):
            raise LmsError("refresh token already used")
        self.log.setdefault("used", set()).add(token_data["refresh_token"])
        return self._tok(int(token_data["refresh_token"].split("-")[1]) + 1)

    def session(self, token_data: dict):
        self.log.setdefault("sessions", []).append(token_data["access_token"])
        return self

    def revoke(self, token_data: dict) -> None:
        self.log.setdefault("revoked", []).append(token_data["access_token"])

    def user_info(self, token_data: dict) -> dict:
        return {"sub": "u42", "name": "Prof. Ada", "email": ""}

    def courses(self) -> list[dict]:
        return [{"id": "c1", "name": "MTH1W-01", "section": "Sec A"}]

    def assignments(self, course_id: str) -> list[dict]:
        return [{"id": "a1", "title": "Linear Relations Check"}]

    def student_names(self, course_id: str) -> dict[str, str]:
        return {"lms_ada": "Ada Lovelace", "lms_bob": "Bob Ross"}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        return [
            {"id": "sub_1", "userId": "lms_ada", "state": "TURNED_IN",
             "files": [{"id": "f_ada", "title": "work.jpg", "url": "https://lms.test/f_ada"}]},
            {"id": "sub_2", "userId": "lms_bob", "state": "CREATED", "files": []},
        ]

    def download(self, file_id: str, file_url: str | None = None) -> tuple[bytes, str]:
        if file_id not in self.pages:
            raise LmsError("not found")
        return self.pages[file_id], "image/jpeg"

    def sync_grade(self, course_id, work_id, lms_user_id, submission_id, score, max_score, feedback) -> None:
        self.log.setdefault("synced", []).append((course_id, work_id, lms_user_id, score, max_score))


@pytest.fixture
def lmslog(deps):
    log: dict = {}
    deps.lms_sealer = Sealer(Sealer.new_key())
    deps.lms_factory = lambda pid, school: FakeLmsProvider(pid, school, log)
    return log


def pro_teacher(client, deps, uid="teach1"):
    client.post("/me", headers=auth(uid), json={"role": "teacher", "name": "Ms. Teacher"})
    deps.store.put("users", uid, {**deps.store.get("users", uid), "plan": "pro"})


def admin(client, **body):
    return client.post("/internal/lms-schools", headers={"X-Batch-Token": "s3cret"}, json=body)


def connect(client, uid="teach1", url=SCHOOL):
    return client.post("/lms/brightspace/connect", headers=auth(uid), json={"instanceUrl": url})


def state_of(url: str) -> str:
    return url.split("state=")[1].split("&")[0]


# ------------------------------------------------------------------ helpers
def test_normalize_instance_url():
    assert normalize_instance_url("https://school.brightspace.com/") == "https://school.brightspace.com"
    assert normalize_instance_url("School.Instructure.com") == "https://school.instructure.com"
    for bad in ("", "http://school.brightspace.com", "https://localhost:8080", "https://127.0.0.1",
                "https://10.0.0.8", "https://intranet", "https://user:pw@school.ca"):
        with pytest.raises(LmsError):
            normalize_instance_url(bad)


def test_sso_uid_includes_the_school():
    a = sso_uid("canvas", "https://a.instructure.com", "17")
    b = sso_uid("canvas", "https://b.instructure.com", "17")
    assert a != b and a.startswith("lms_canvas_") and len(a) <= 128
    assert sso_uid("microsoft_edu", None, "abc") == "lms_microsoft_edu_abc"


def test_sealer_round_trip_and_tamper():
    s = Sealer(Sealer.new_key())
    sealed = s.seal({"secret": "shh"})
    assert "shh" not in sealed and s.unseal(sealed) == {"secret": "shh"}
    with pytest.raises(LmsError):
        Sealer(Sealer.new_key()).unseal(sealed)


# ------------------------------------------------------------------ API flow
def test_school_request_then_setup_connect_import_sync(client, deps, lmslog):
    pro_teacher(client, deps)
    bs = next(p for p in client.get("/lms/providers", headers=auth("teach1")).json() if p["id"] == "brightspace")
    assert bs["configured"] is True and bs["connected"] is False and bs["school"] is None

    assert connect(client, url="").status_code == 422
    # School not set up yet: the request is recorded, no redirect.
    r = connect(client, url="board.brightspace.com/")
    assert r.status_code == 200 and r.json() == {"url": None, "school": "requested"}
    connect(client)  # asking twice adds one request
    bs = next(p for p in client.get("/lms/providers", headers=auth("teach1")).json() if p["id"] == "brightspace")
    assert bs["school"] == "requested" and bs["instanceUrl"] == SCHOOL

    rows = client.get("/internal/lms-schools", headers={"X-Batch-Token": "s3cret"}).json()
    assert [(r["id"], len(r["requests"]), r["hasKeys"]) for r in rows] == [("brightspace:board.brightspace.com", 1, False)]
    assert client.get("/internal/lms-schools").status_code == 401

    # Turning it on needs keys; the secret is sealed and never returned.
    assert admin(client, provider="brightspace", instanceUrl=SCHOOL).status_code == 422
    r = admin(client, provider="brightspace", instanceUrl=SCHOOL, name="Board", clientId="cid", clientSecret="topsecret")
    assert r.status_code == 200 and r.json()["status"] == "active" and "clientSecret" not in r.json()
    stored = deps.store.get("lmsschools", "brightspace:board.brightspace.com")
    assert "topsecret" not in json.dumps(stored)

    res = connect(client)
    assert res.json()["school"] == "active"
    cb = client.get(f"/lms/brightspace/callback?state={state_of(res.json()['url'])}&code=good", follow_redirects=False)
    assert cb.status_code == 303 and cb.headers["location"].endswith("/teacher?lms=brightspace&status=connected")
    tok = deps.store.get("lmstokens", "teach1:brightspace")
    assert "acc-1" not in json.dumps(tok)  # sealed
    # The school's secret reached the provider, unsealed.
    assert client.get("/lms/brightspace/courses", headers=auth("teach1")).json()[0]["id"] == "c1"
    assert lmslog["sessions"] == ["acc-1"]

    assert client.get("/lms/brightspace/courses/c1/assignments", headers=auth("teach1")).json()[0]["id"] == "a1"
    imp = client.post("/lms/brightspace/courses/c1/assignments/a1/import", headers=auth("teach1"),
                      json={"course": "MTH1W", "unitTopic": "Linear Relations"}).json()
    assert len(imp["imported"]) == 1 and len(imp["skipped"]) == 1
    sub_id = imp["imported"][0]["submissionId"]
    assert client.post(f"/submissions/{sub_id}/process", headers=auth("teach1")).status_code == 200
    sync = client.post("/lms/brightspace/courses/c1/assignments/a1/sync", headers=auth("teach1")).json()
    assert len(sync["synced"]) == 1 and len(lmslog["synced"]) == 1

    assert client.delete("/lms/brightspace", headers=auth("teach1")).status_code == 204
    assert lmslog["revoked"] == ["acc-1"]
    assert deps.store.get("lmstokens", "teach1:brightspace") is None


def test_refresh_is_stored_and_reused(client, deps, lmslog):
    pro_teacher(client, deps)
    admin(client, provider="brightspace", instanceUrl=SCHOOL, clientId="cid", clientSecret="s")
    lmslog["life"] = 0  # the first access token is already out of date
    url = connect(client).json()["url"]
    client.get(f"/lms/brightspace/callback?state={state_of(url)}&code=good")
    client.get("/lms/brightspace/courses", headers=auth("teach1"))
    client.get("/lms/brightspace/courses", headers=auth("teach1"))
    # Refreshed once with ref-1; the new token (acc-2, ref-2) was saved and used after.
    assert lmslog["refreshed"] == ["ref-1"] and lmslog["sessions"] == ["acc-2", "acc-2"]


def test_refresh_refused_disconnects(client, deps, lmslog):
    pro_teacher(client, deps)
    admin(client, provider="brightspace", instanceUrl=SCHOOL, clientId="cid", clientSecret="s")
    lmslog["life"] = 0
    url = connect(client).json()["url"]
    client.get(f"/lms/brightspace/callback?state={state_of(url)}&code=good")
    lmslog["used"] = {"ref-1"}  # e.g. the teacher removed Quark in Brightspace
    r = client.get("/lms/brightspace/courses", headers=auth("teach1"))
    assert r.status_code == 409 and deps.store.get("lmstokens", "teach1:brightspace") is None


def test_only_pro_teachers_and_state_is_single_use(client, deps, lmslog):
    client.post("/me", headers=auth("free"), json={"role": "teacher", "name": "Free"})
    assert connect(client, uid="free").status_code == 402
    pro_teacher(client, deps)
    admin(client, provider="brightspace", instanceUrl=SCHOOL, clientId="cid", clientSecret="s")
    st = state_of(connect(client).json()["url"])
    client.get(f"/lms/brightspace/callback?state={st}&code=good")
    again = client.get(f"/lms/brightspace/callback?state={st}&code=good", follow_redirects=False)
    assert again.headers["location"].endswith("status=failed")
    # A sign-in state coming back to the shared callback signs in; it never connects.
    sso = client.post("/auth/lms/brightspace/connect", json={"instanceUrl": SCHOOL}).json()["url"]
    cb = client.get(f"/lms/brightspace/callback?state={state_of(sso)}&code=good", follow_redirects=False)
    assert "/#ssoToken=" in cb.headers["location"]
    assert deps.store.get("lmstokens", "teach1:brightspace")["connectedAt"]  # still the first connect


def test_declining_a_school_disconnects_its_teachers(client, deps, lmslog):
    pro_teacher(client, deps)
    admin(client, provider="brightspace", instanceUrl=SCHOOL, clientId="cid", clientSecret="s")
    client.get(f"/lms/brightspace/callback?state={state_of(connect(client).json()['url'])}&code=good")
    assert admin(client, provider="brightspace", instanceUrl=SCHOOL, status="declined").json()["status"] == "declined"
    assert deps.store.get("lmstokens", "teach1:brightspace") is None
    assert client.get("/lms/brightspace/courses", headers=auth("teach1")).status_code == 409


def test_sign_in_with_school_lms(client, deps, lmslog):
    # Not set up: no redirect to an unknown site.
    r = client.post("/auth/lms/canvas/connect", json={"instanceUrl": "https://evil.example.com"})
    assert r.status_code == 409
    admin(client, provider="canvas", instanceUrl="https://school.instructure.com", clientId="1", clientSecret="s")
    r = client.post("/auth/lms/canvas/connect", json={"instanceUrl": "school.instructure.com"})
    assert r.status_code == 200 and r.json()["url"].startswith("https://school.instructure.com/oauth")
    cb = client.get(f"/auth/lms/canvas/callback?state={state_of(r.json()['url'])}&code=good", follow_redirects=False)
    loc = cb.headers["location"]
    assert cb.status_code == 303 and "/#ssoToken=dev%3Alms_canvas_" in loc and "?" not in loc
    assert lmslog["revoked"] == ["acc-1"]  # sign-in keeps no LMS token
    bad = client.get("/auth/lms/canvas/callback?state=nope&code=good", follow_redirects=False)
    assert "ssoError=canvas" in bad.headers["location"]


def test_not_configured_without_key(client, deps):
    pro_teacher(client, deps)
    bs = next(p for p in client.get("/lms/providers", headers=auth("teach1")).json() if p["id"] == "brightspace")
    assert bs["configured"] is False
    assert connect(client).status_code == 503


# ------------------------------------------------------------------ provider HTTP
class FakeHttp:
    """Stands in for lms._call: maps URL prefixes to (json, headers)."""

    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def __call__(self, req, limit=None):
        url = req.full_url
        self.calls.append((req.get_method(), url, req.data, dict(req.header_items())))
        for prefix, (body, headers) in self.routes.items():
            if url.startswith(prefix):
                return (body if isinstance(body, bytes) else json.dumps(body).encode()), headers
        raise LmsError(f"no route for {url}")


def test_canvas_pages_scopes_and_grade(monkeypatch):
    base = "https://school.instructure.com"
    http = FakeHttp({
        f"{base}/api/v1/courses?": ([{"id": 1, "name": "Math", "course_code": "MPM2D"}],
                                    {"link": f'<{base}/api/v1/next-page>; rel="next", <{base}/x>; rel="last"'}),
        f"{base}/api/v1/next-page": ([{"id": 2, "name": "Math B"}], {}),
        f"{base}/api/v1/courses/1/assignments/9/submissions": ([
            {"id": 5, "user_id": 7, "workflow_state": "submitted",
             "attachments": [{"id": 3, "url": f"{base}/files/3/download?verifier=x", "content-type": "image/jpeg"},
                             {"id": 4, "url": f"{base}/files/4", "content-type": "application/pdf"}]}], {}),
        f"{base}/login/oauth2/token": ({"access_token": "a", "refresh_token": "r", "expires_in": 3600,
                                        "user": {"id": 7, "name": "Ada"}}, {}),
        f"{base}/api/v1/courses/1/assignments/9/submissions/7": ({}, {}),
    })
    monkeypatch.setattr(lms, "_call", http)
    prov = school_provider("canvas", {"clientId": "10", "clientSecret": "s", "instanceUrl": base},
                           "https://api.test")
    assert isinstance(prov, CanvasProvider)
    assert "scope=url%3AGET" in prov.auth_url("st") and "redirect_uri=https%3A%2F%2Fapi.test%2Flms%2Fcanvas%2Fcallback" in prov.auth_url("st")
    tok = prov.exchange("code")
    assert prov.user_info(tok) == {"sub": "7", "name": "Ada", "email": ""}
    sess = prov.session(tok)
    assert [c["id"] for c in sess.courses()] == ["1", "2"]
    subs = sess.submissions("1", "9")
    assert subs[0]["state"] == "TURNED_IN" and [f["id"] for f in subs[0]["files"]] == ["3"]
    with pytest.raises(LmsError):
        sess.download("9", "https://elsewhere.example.com/f")  # never send the token off-site
    sess.sync_grade("1", "9", "7", None, 8, 10, "Nice")
    method, _, data, _ = http.calls[-1]
    assert method == "PUT" and json.loads(data)["submission"]["posted_grade"] == "80.00%"
    assert prov.refresh(tok)["refresh_token"] == "r"


def test_brightspace_bookmarks_latest_submission_and_feedback(monkeypatch):
    base = "https://board.brightspace.com"
    lp, le = f"{base}/d2l/api/lp/1.43", f"{base}/d2l/api/le/1.67"
    http = FakeHttp({
        f"{lp}/enrollments/myenrollments/?orgUnitTypeId=3&bookmark=b2": (
            {"PagingInfo": {"Bookmark": None, "HasMoreItems": False},
             "Items": [{"OrgUnit": {"Id": 2, "Name": "B"}, "Access": {"IsActive": False}}]}, {}),
        f"{lp}/enrollments/myenrollments/": (
            {"PagingInfo": {"Bookmark": "b2", "HasMoreItems": True}, "Items": [{"OrgUnit": {"Id": 1, "Name": "A"}}]}, {}),
        f"{le}/1/dropbox/folders/9/submissions/": ([
            {"Entity": {"EntityId": 7, "EntityType": "User"},
             "Submissions": [{"Id": 100, "Files": [{"FileId": 1, "FileName": "old.jpg"}]},
                             {"Id": 101, "Files": [{"FileId": 2, "FileName": "new.jpg"}]}]},
            {"Entity": {"EntityId": 8, "EntityType": "User"}, "Submissions": []},
            {"Entity": {"EntityId": 3, "EntityType": "Group"}, "Submissions": [{"Id": 5, "Files": []}]}], {}),
        f"{le}/1/dropbox/folders/9/feedback/": ({}, {}),
        f"{le}/1/dropbox/folders/9": ({"Assessment": {"ScoreDenominator": 20}}, {}),
        BrightspaceProvider.TOKEN_URL: ({"access_token": "a2", "refresh_token": "r2", "expires_in": 1800}, {}),
    })
    monkeypatch.setattr(lms, "_call", http)
    prov = school_provider("brightspace", {"clientId": "c", "clientSecret": "s", "instanceUrl": base},
                           "https://api.test")
    assert "scope=enrollment%3Aown_enrollment%3Aread" in prov.auth_url("st")
    sess = prov.session({"access_token": "a"})
    assert [c["id"] for c in sess.courses()] == ["1"]  # page 2 followed; inactive course left out
    subs = sess.submissions("1", "9")
    assert [(s["userId"], s["state"], [f["id"] for f in s["files"]]) for s in subs] == [
        ("7", "TURNED_IN", ["2"]), ("8", "CREATED", [])]
    assert subs[0]["files"][0]["url"].endswith("/submissions/101/files/2")
    sess.sync_grade("1", "9", "7", None, 8, 10, "Nice")
    method, url, data, _ = http.calls[-1]
    assert method == "POST" and url.endswith("/feedback/user/7") and json.loads(data)["Score"] == 16
    new = prov.refresh({"refresh_token": "r1"})
    assert new["refresh_token"] == "r2" and b"grant_type=refresh_token" in http.calls[-1][2]
