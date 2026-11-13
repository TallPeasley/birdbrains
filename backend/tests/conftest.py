import itertools
import io
import os

os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from birdbrains.api import Deps, create_app
from birdbrains.auth import DevAuthenticator
from birdbrains.fake import FakeBatchEngine, FakePipeline
from birdbrains.storage import LocalStorage
from birdbrains.store import MemoryStore


@pytest.fixture
def deps(tmp_path):
    return Deps(store=MemoryStore(), storage=LocalStorage(str(tmp_path)), pipeline=FakePipeline(),
                batch=FakeBatchEngine(), auth=DevAuthenticator(), batch_token="s3cret", inline_images=True)


@pytest.fixture
def client(deps):
    return TestClient(create_app(deps))


def auth(uid):
    return {"Authorization": f"Bearer dev:{uid}"}


_photo_count = itertools.count(1)


def photo(width=1600, height=1200, fmt="JPEG"):
    """A blank page. Each call differs slightly so the duplicate check (UT-06) does not fire."""
    n = next(_photo_count)
    img = Image.new("RGB", (width, height), "white")
    img.paste((n % 256, (n // 256) % 256, 0), (0, 0, 8, 8))
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


@pytest.fixture
def family(client):
    """A registered student, their linked parent, and an unrelated parent."""
    student = client.post("/me", json={"role": "student", "name": "Alex Mercer", "course": "MPM2D"},
                          headers=auth("alex")).json()
    client.post("/me", json={"role": "parent", "name": "Jordan Mercer"}, headers=auth("jordan"))
    client.post("/me/children", json={"linkCode": student["linkCode"]}, headers=auth("jordan"))
    client.post("/me", json={"role": "parent", "name": "Stranger"}, headers=auth("stranger"))
    return student


def upload(client, student_id, uid="alex", **overrides):
    data = {"studentId": student_id, "course": "MPM2D", "unitTopic": "Completing the Square · vertex form",
            "sharpnessScore": "82"} | overrides.pop("data", {})
    files = overrides.pop("files", [("files", ("p1.jpg", photo(), "image/jpeg"))])
    return client.post("/submissions", data=data, files=files, headers=auth(uid))
