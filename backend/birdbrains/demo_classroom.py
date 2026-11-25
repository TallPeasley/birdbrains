"""A pretend Google Classroom for testing, with no Google account involved.

``BIRDBRAINS_CLASSROOM=demo`` swaps it in for ``GoogleClassroom``. It serves three
classes of invented students, assignments tied to the test worksheets, and
submissions in every state a real class has: handed in, returned, missing, and a
PDF the importer must skip. Everything is deterministic, so a test run can be
repeated. It is refused on Cloud Run (see ``deps_from_env``).

Names are made up. Photos are generated pages, except the first student on the
BB-W11 and BB-W12 assignments, who hand in real filled-in test photos.
"""
from __future__ import annotations

import io
import pathlib
import random

from PIL import Image, ImageDraw, ImageFont

from .classroom import SCOPES, ClassroomError

_DIR = pathlib.Path(__file__).parent / "demo"

_FIRST = ["Ana", "Ben", "Cy", "Di", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lea", "Moe", "Nia", "Oz",
          "Pia", "Quinn", "Rae", "Sol", "Tia", "Uma", "Val", "Wes", "Zed"]
_LAST = ["Silva", "Okoro", "Tran", "Wu", "Novak", "Haddad", "Singh", "Kowal", "Reyes", "Park", "Mensah", "Roy",
         "Lund", "Ito", "Abara", "Costa", "Dube", "Ehret", "Fong", "Gill", "Hart", "Ames", "Boyd", "Cole"]

# (course id, name, section, grade course) and its assignments (id, title, worksheet key or None)
CLASSES = [
    ("demo-c1", "MPM2D-01", "Period 2", [("demo-c1-w1", "Trigonometry II station work (BB-W11)", "w11"),
                                         ("demo-c1-w2", "Mixed review (BB-W12)", "w12"),
                                         ("demo-c1-w3", "Linear systems exit ticket", None)]),
    ("demo-c2", "MPM2D-03", "Period 4", [("demo-c2-w1", "Quadratics check-in", None),
                                         ("demo-c2-w2", "Analytic geometry quiz", None)]),
    ("demo-c3", "MTH1W-02", "Period 1", [("demo-c3-w1", "Linear relations practice", None)]),
]
_PER_CLASS = 8
_STATES = ["TURNED_IN", "TURNED_IN", "TURNED_IN", "RETURNED", "TURNED_IN", "CREATED", "TURNED_IN", "TURNED_IN"]


def _students(course_id: str) -> dict[str, str]:
    i = [c[0] for c in CLASSES].index(course_id)
    return {f"demo-u{i}{j}": f"{_FIRST[i * _PER_CLASS + j]} {_LAST[i * _PER_CLASS + j]}" for j in range(_PER_CLASS)}


def _page(seed: str) -> bytes:
    """A worksheet-like page, different for every seed so the duplicate check passes."""
    rng = random.Random(seed)
    img = Image.new("RGB", (1600, 1200), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 34)
    except OSError:
        font = ImageFont.load_default()
    draw.text((80, 50), "Name: ____________    Date: ________", fill="black", font=font)
    for n in range(1, 8):
        a, b, c = rng.randint(2, 9), rng.randint(2, 9), rng.randint(10, 60)
        y = 150 + n * 130
        draw.text((80, y), f"{n}.  {a}x + {b} = {c}", fill="black", font=font)
        draw.text((160, y + 55), f"{a}x = {c} - {b}", fill=(30, 30, 120), font=font)
    for _ in range(40):
        x, y = rng.randint(0, 1590), rng.randint(0, 1190)
        draw.rectangle((x, y, x + 8, y + 8), fill=tuple(rng.randint(150, 255) for _ in range(3)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


class DemoClassroom:
    def __init__(self, public_url: str = "http://localhost:8080") -> None:
        self.redirect = public_url.rstrip("/") + "/classroom/callback"
        self.revoked: list[str] = []

    # --- Classroom protocol
    def auth_url(self, state: str, scopes: tuple[str, ...] = SCOPES) -> str:
        return f"{self.redirect}?state={state}&code=demo"  # skips the consent screen

    def exchange(self, code: str) -> str:
        if code != "demo":
            raise ClassroomError("bad code")
        return "demo-refresh"

    def open(self, refresh_token: str) -> "DemoClassroom":
        if refresh_token != "demo-refresh":
            raise ClassroomError("access was revoked")
        return self

    def revoke(self, refresh_token: str) -> None:
        self.revoked.append(refresh_token)

    # --- ClassroomSession protocol
    def courses(self) -> list[dict]:
        return [{"id": cid, "name": name, "section": section} for cid, name, section, _ in CLASSES]

    def coursework(self, course_id: str) -> list[dict]:
        for cid, _, _, work in CLASSES:
            if cid == course_id:
                return [{"id": wid, "title": title} for wid, title, _ in work]
        raise ClassroomError("unknown course")

    def student_names(self, course_id: str) -> dict[str, str]:
        if course_id not in [c[0] for c in CLASSES]:
            raise ClassroomError("unknown course")
        return _students(course_id)

    def submissions(self, course_id: str, work_id: str) -> list[dict]:
        out = []
        for j, uid in enumerate(_students(course_id)):
            state = _STATES[j]
            files = [] if state == "CREATED" else [{"id": f"{work_id}:{uid}", "title": "work.jpg"}]
            if j == 7:  # one student per assignment hands in a PDF, which cannot be read
                files = [{"id": f"{work_id}:{uid}:pdf", "title": "work.pdf"}]
            out.append({"userId": uid, "state": state, "files": files})
        return out

    def download(self, file_id: str) -> tuple[bytes, str]:
        if file_id.endswith(":pdf"):
            raise ClassroomError("not a photo (JPEG, PNG or WebP)")
        work_id, _, uid = file_id.partition(":")
        key = next((k for cid, _, _, work in CLASSES for wid, _, k in work if wid == work_id and k), None)
        if key and uid.endswith("0") and (_DIR / f"{key}.jpg").exists():  # the first student's real photo
            return (_DIR / f"{key}.jpg").read_bytes(), "image/jpeg"
        return _page(file_id), "image/jpeg"

    # --- Student side: a student enrolled in the first two classes
    def my_courses(self) -> list[dict]:
        return [{"id": cid, "name": name, "section": section} for cid, name, section, _ in CLASSES[:2]]

    def my_work(self, course_id: str) -> list[dict]:
        for cid, _, _, work in CLASSES[:2]:
            if cid == course_id:
                out = []
                for i, (wid, title, _) in enumerate(work):
                    returned = i % 2 == 0
                    out.append({
                        "id": wid, "title": title,
                        "description": "Show every step. Write the formula before you substitute, and give the "
                                       "final answer with units, rounded to one decimal place.",
                        "maxPoints": 20, "dueDate": f"2026-11-{10 + i:02d}",
                        "link": f"https://classroom.google.com/demo/{wid}",
                        "state": "RETURNED" if returned else "TURNED_IN",
                        "assignedGrade": (14 + i) if returned else None,
                        "rubric": [
                            {"title": "Method", "description": "Chooses and sets up the right method",
                             "levels": [{"title": "Full", "points": 8}, {"title": "Partial", "points": 4}]},
                            {"title": "Accuracy", "description": "Arithmetic and final answer are correct",
                             "levels": [{"title": "Full", "points": 8}, {"title": "Partial", "points": 4}]},
                            {"title": "Communication", "description": "Steps, units and a concluding statement",
                             "levels": [{"title": "Full", "points": 4}, {"title": "Partial", "points": 2}]},
                        ] if i == 0 else [],
                    })
                return out
        raise ClassroomError("unknown course")
