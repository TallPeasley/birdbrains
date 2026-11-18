import pytest

from conftest import auth, photo
from birdbrains.lms import LmsError, normalize_instance_url


class FakeLmsProvider:
    def __init__(self, provider_id: str, requires_instance_url: bool = False):
        self.provider_id = provider_id
        self.requires_instance_url = requires_instance_url
        self.revoked = []
        self.synced = []
        self.pages = {"f_ada": photo()}

    def auth_url(self, state: str, instance_url: str | None = None, sso: bool = False) -> str:
        base = instance_url or f"https://{self.provider_id}.test"
        return f"{base}/oauth?state={state}&sso={int(sso)}"

    def exchange(self, code: str, instance_url: str | None = None, sso: bool = False) -> dict:
        if code != "good":
            raise LmsError("bad code")
        return {"access_token": "acc-1", "refresh_token": "ref-1", "instance_url": instance_url}

    def open(self, token_data: dict):
        assert token_data["access_token"] == "acc-1"
        return self

    def revoke(self, token_data: dict) -> None:
        self.revoked.append(token_data)

    def user_info(self, access_token: str, instance_url: str | None = None) -> dict:
        return {"sub": "u42", "name": "Prof. Ada", "email": "ada@school.edu"}

    def courses(self) -> list[dict]:
        return [{"id": "c1", "name": "MTH1W-01", "section": "Sec A"}]

    def assignments(self, course_id: str) -> list[dict]:
        return [{"id": "a1", "title": "Linear Relations Check"}]

    def student_names(self, course_id: str) -> dict[str, str]:
        return {"lms_ada": "Ada Lovelace", "lms_bob": "Bob Ross"}

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        return [
            {
                "id": "sub_1",
                "userId": "lms_ada",
                "state": "TURNED_IN",
                "files": [{"id": "f_ada", "title": "work.jpg", "url": "https://lms.test/f_ada"}],
            },
            {"id": "sub_2", "userId": "lms_bob", "state": "CREATED", "files": []},
        ]

    def download(self, file_id: str, file_url: str | None = None) -> tuple[bytes, str]:
        if file_id not in self.pages:
            raise LmsError("not found")
        return self.pages[file_id], "image/jpeg"

    def sync_grade(self, course_id, work_id, lms_user_id, submission_id, score, max_score, feedback) -> None:
        self.synced.append((course_id, work_id, lms_user_id, submission_id, score, max_score, feedback))


def test_normalize_instance_url():
    assert normalize_instance_url("https://school.brightspace.com/") == "https://school.brightspace.com"
    for bad in ("", "http://school.brightspace.com", "https://localhost:8080", "https://127.0.0.1"):
        with pytest.raises(LmsError):
            normalize_instance_url(bad)


def test_lms_connect_import_sync_and_sso(client, deps):
    # Register a Pro teacher
    client.post("/me", headers=auth("teach1"), json={"role": "teacher", "name": "Ms. Teacher"})
    deps.store.put("users", "teach1", {**deps.store.get("users", "teach1"), "plan": "pro"})

    bs = FakeLmsProvider("brightspace", requires_instance_url=True)
    deps.lms_providers["brightspace"] = bs

    # Providers list shows brightspace configured
    provs = client.get("/lms/providers", headers=auth("teach1")).json()
    bs_status = next(p for p in provs if p["id"] == "brightspace")
    assert bs_status["configured"] is True
    assert bs_status["connected"] is False
    assert bs_status["requiresInstanceUrl"] is True

    # Missing instanceUrl fails 422
    assert client.post("/lms/brightspace/connect", headers=auth("teach1"), json={}).status_code == 422

    # Connect flow
    res = client.post(
        "/lms/brightspace/connect",
        headers=auth("teach1"),
        json={"instanceUrl": "https://board.brightspace.com"},
    )
    assert res.status_code == 200
    state = res.json()["url"].split("state=")[1].split("&")[0]

    cb = client.get(f"/lms/brightspace/callback?state={state}&code=good", follow_redirects=False)
    assert cb.status_code == 303
    assert cb.headers["location"].endswith("/teacher?lms=brightspace&status=connected")

    # Courses, assignments, import
    assert client.get("/lms/brightspace/courses", headers=auth("teach1")).json()[0]["id"] == "c1"
    assert client.get("/lms/brightspace/courses/c1/assignments", headers=auth("teach1")).json()[0]["id"] == "a1"

    imp = client.post(
        "/lms/brightspace/courses/c1/assignments/a1/import",
        headers=auth("teach1"),
        json={"course": "MTH1W", "unitTopic": "Linear Relations"},
    ).json()
    assert len(imp["imported"]) == 1
    assert len(imp["skipped"]) == 1
    sub_id = imp["imported"][0]["submissionId"]

    # Grade submission then sync back to LMS
    proc = client.post(f"/submissions/{sub_id}/process", headers=auth("teach1"))
    assert proc.status_code == 200

    sync = client.post("/lms/brightspace/courses/c1/assignments/a1/sync", headers=auth("teach1")).json()
    assert len(sync["synced"]) == 1
    assert len(bs.synced) == 1

    # SSO connect + callback
    sso = client.post(
        "/auth/lms/brightspace/connect",
        json={"instanceUrl": "https://board.brightspace.com"},
    )
    assert sso.status_code == 200
    sso_state = sso.json()["url"].split("state=")[1].split("&")[0]
    sso_cb = client.get(f"/auth/lms/brightspace/callback?state={sso_state}&code=good", follow_redirects=False)
    assert sso_cb.status_code == 303
    assert "ssoToken=dev%3Alms_brightspace_u42" in sso_cb.headers["location"]

    # Disconnect
    assert client.delete("/lms/brightspace", headers=auth("teach1")).status_code == 204
    assert len(bs.revoked) == 1
