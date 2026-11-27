#!/usr/bin/env python3
"""End-to-end check of the live API: the week 1 exit check and the Free vs Pro test,
run by a script instead of by hand.

Against the live project (from backend/, on any machine signed in to gcloud):

    python tools/smoke_test.py --url https://<api> --firebase-key <web API key> \\
      --batch-token "$(gcloud secrets versions access latest --secret=birdbrains-batch-token)" \\
      [--photo path/to/real-worksheet.jpg] [--grade-all]

The web API key is the public NEXT_PUBLIC_FIREBASE_API_KEY (Firebase console > Project settings > Your apps). The script
signs up three throwaway accounts (student, parent, stranger), runs the checks, then
deletes the accounts and everything they uploaded. Locally, against the dev backend:

    python tools/smoke_test.py --url http://localhost:8080 --dev --batch-token dev

Model cost: two graded uploads by default (one Free, one Pro). The uploads used to
reach the Free cap are not graded.
"""
from __future__ import annotations

import argparse
import io
import secrets
import sys
import time

import httpx
from PIL import Image, ImageChops, ImageDraw, ImageFont

RESULTS: list[tuple[str, str, str]] = []  # (PASS | FAIL | SKIP, name, detail)


def check(name: str, ok: bool | None, detail: str = "") -> bool:
    RESULTS.append(("SKIP" if ok is None else "PASS" if ok else "FAIL", name, detail))
    print(f"  {RESULTS[-1][0]:4}  {name}" + (f"  ({detail})" if detail else ""), flush=True)
    return bool(ok)


def page(seed: int, name_line: bool = False, size=(1600, 1200), base: Image.Image | None = None) -> bytes:
    """A generated page of 'work'. Every seed gives different bytes."""
    img = base.copy() if base else Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=44)
    if name_line:
        draw.text((80, 50), "Name: Jordan Testcase     Date: Nov 16     Class: MPM2D-03", fill="black", font=font)
    if not base:
        for i, line in enumerate(["y = 2x^2 + 12x + 5", "y = 2(x^2 + 6x) + 5", "y = 2(x^2 + 6x + 9 - 9) + 5",
                                  "y = 2(x + 3)^2 - 9 + 5", "y = 2(x + 3)^2 - 4"]):
            draw.text((120, 220 + 150 * i), line, fill="black", font=font)
    for bit in range(24):  # the seed as a strip of squares along the bottom edge
        if seed >> bit & 1:
            draw.rectangle((20 + 24 * bit, img.height - 40, 40 + 24 * bit, img.height - 20), fill="black")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=92)
    return buf.getvalue()


class Account:
    def __init__(self, args, label: str):
        self.label = label
        if args.dev:
            self.token = f"dev:smoke-{label}-{secrets.token_hex(4)}"
        else:
            email = f"smoke-{label}-{secrets.token_hex(6)}@example.com"
            r = httpx.post("https://identitytoolkit.googleapis.com/v1/accounts:signUp", params={"key": args.firebase_key},
                           json={"email": email, "password": secrets.token_urlsafe(18), "returnSecureToken": True}, timeout=30)
            r.raise_for_status()
            self.token = r.json()["idToken"]
        self.http = httpx.Client(base_url=args.url.rstrip("/"), headers={"Authorization": f"Bearer {self.token}"},
                                 timeout=120)
        self.profile: dict = {}

    def register(self, role: str, **extra) -> dict:
        r = self.http.post("/me", json={"role": role, "name": f"Smoke {self.label.title()}", **extra})
        r.raise_for_status()
        self.profile = r.json()
        return self.profile

    def upload(self, student_id: str, data: bytes, sharpness: float = 90):
        return self.http.post("/submissions", data={"studentId": student_id, "course": "MPM2D",
                                                    "unitTopic": "Completing the Square", "sharpnessScore": str(sharpness)},
                              files=[("files", ("page.jpg", data, "image/jpeg"))])


def run(args) -> None:
    seed = int(time.time()) % (1 << 20) << 4
    base = Image.open(args.photo).convert("RGB") if args.photo else None
    anon = httpx.Client(base_url=args.url.rstrip("/"), timeout=60)
    admin = {"X-Batch-Token": args.batch_token}

    print("Setup")
    check("API answers /health", anon.get("/health").json() == {"ok": True})
    check("Signed-out requests are refused", anon.get("/me").status_code in (401, 403))
    student, parent, stranger = (Account(args, x) for x in ("student", "parent", "stranger"))
    accounts = [student, parent, stranger]
    try:
        sid = student.register("student", course="MPM2D")["studentId"]
        parent.register("parent")
        stranger.register("parent")
        linked = parent.http.post("/me/children", json={"linkCode": student.profile["linkCode"]})
        check("Student signs up; parent links with the code", linked.status_code == 200 and sid in linked.json()["childStudentIds"])

        print("Week 1 exit check")
        first_bytes = page(seed, name_line=True, base=base)
        up = student.upload(sid, first_bytes)
        if not check("A sharp photo is accepted", up.status_code == 201, f"HTTP {up.status_code} {up.text[:120]}"):
            return
        sub = up.json()
        check("A blurry photo is rejected with a retake message",
              (r := student.upload(sid, page(seed + 1), sharpness=20)).status_code == 422 and "blurry" in r.text.lower())
        check("A small photo is rejected", student.upload(sid, page(seed + 2, size=(640, 480))).status_code == 422)
        dup = student.upload(sid, first_bytes)
        check("The same photo twice is rejected", dup.status_code == 409, f"HTTP {dup.status_code}")

        stored = student.http.get(f"/submissions/{sub['submissionId']}/files/0")
        if args.dev or base is not None:
            check("The name line is blurred in the stored photo", None,
                  "needs the live project and the generated page (no --photo, no --dev)")
        else:
            a = Image.open(io.BytesIO(first_bytes)).convert("L").crop((80, 40, 1500, 110))
            b = Image.open(io.BytesIO(stored.content)).convert("L").resize((1600, 1200)).crop((80, 40, 1500, 110))
            changed = sum(1 for px in ImageChops.difference(a, b).getdata() if px > 60) / (a.width * a.height)
            check("The name line is blurred in the stored photo", changed > 0.02, f"{changed:.0%} of the name strip changed")

        g = student.http.post(f"/submissions/{sub['submissionId']}/process")
        status = g.json()["submission"]["status"] if g.status_code == 200 else f"HTTP {g.status_code}"
        graded = status == "GRADED"
        check("The diagnostic arrives", graded or (status == "NEEDS_RETAKE" and base is None),
              status + ("" if graded else ": the generated page was judged unreadable; pass --photo with a real page"))
        free_grading = g.json().get("grading") if graded else None

        print("Free plan")
        use = student.http.get(f"/students/{sid}/usage").json()
        check("New accounts start on Free with a monthly cap", use["plan"] == "free" and use["monthlyLimit"],
              f"{use['usedThisMonth']} of {use['monthlyLimit']} used")
        if free_grading:
            check("Free result has error codes and feedback but no mood", free_grading["plan"] == "free"
                  and free_grading["affectState"] is None and len(free_grading["pillarBreakdowns"]) == 6)
            ws = student.http.get(f"/gradings/{free_grading['gradingId']}/worksheet").json().get("detail", "")
            check("Free gets no nightly worksheet", ws in ("WORKSHEET_PRO_ONLY", "WORKSHEET_NOT_NEEDED"), ws)
        n = 0
        while use["remaining"] and n < 40:  # fill the cap; these uploads are not graded
            n += 1
            r = student.upload(sid, page(seed + 10 + n))
            if r.status_code != 201:
                break
            if args.grade_all:
                student.http.post(f"/submissions/{r.json()['submissionId']}/process")
            use = student.http.get(f"/students/{sid}/usage").json()
        blocked = student.upload(sid, page(seed + 99))
        check("At the cap the next upload is blocked with the upgrade signal",
              blocked.status_code == 402 and "FREE_LIMIT_REACHED" in blocked.text, f"HTTP {blocked.status_code}")

        print("Pro plan")
        r = anon.post(f"/internal/users/{parent.profile['uid']}/plan", json={"plan": "pro"}, headers=admin)
        check("Admin can put the parent on Pro", r.status_code == 200, f"HTTP {r.status_code}")
        use = student.http.get(f"/students/{sid}/usage").json()
        check("A Pro parent covers the linked student: no cap", use["plan"] == "pro" and use["monthlyLimit"] is None)
        up = student.upload(sid, page(seed + 100, base=base))
        check("Uploads work again on Pro", up.status_code == 201, f"HTTP {up.status_code}")
        if up.status_code == 201:
            g = student.http.post(f"/submissions/{up.json()['submissionId']}/process")
            status = g.json()["submission"]["status"] if g.status_code == 200 else f"HTTP {g.status_code}"
            if status == "GRADED":
                pro = g.json()["grading"]
                check("Pro result includes mood tracking", pro["plan"] == "pro" and pro["affectState"] is not None,
                      str(pro["affectState"]))
                ws = student.http.get(f"/gradings/{pro['gradingId']}/worksheet").json().get("detail", "")
                check("Pro result queues a worksheet when there is an error",
                      ws in ("WORKSHEET_QUEUED", "WORKSHEET_PENDING", "WORKSHEET_NOT_NEEDED"), ws)
            else:
                check("Pro result includes mood tracking", None, f"upload was not graded: {status}")

        print("Dashboards and privacy")
        check("Parent sees the summary", parent.http.get(f"/students/{sid}/parent-summary").status_code == 200)
        prog = parent.http.get(f"/students/{sid}/progress")
        check("Progress report loads", prog.status_code == 200 and prog.json()["uploads"] >= (1 if graded else 0))
        check("Another family cannot see this student",
              all(stranger.http.get(p).status_code == 404 for p in
                  (f"/students/{sid}/gradings", f"/students/{sid}/progress", f"/submissions/{sub['submissionId']}")))
        check("Admin routes refuse a wrong token",
              anon.get("/internal/stats", headers={"X-Batch-Token": "wrong"}).status_code == 401)
        st = anon.get("/internal/stats", headers=admin)
        check("Daily summary numbers load", st.status_code == 200 and st.json()["uploads"] >= 2, f"HTTP {st.status_code}")
    finally:
        print("Clean up")
        sid = student.profile.get("studentId")
        gone = [a.http.delete("/me").status_code for a in accounts if a.profile]
        check("Test accounts and their data are deleted", all(c == 204 for c in gone), str(gone))
        if sid and parent.profile:
            check("Deleted student's data is gone", student.http.get(f"/students/{sid}/gradings").status_code in (401, 403, 404))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", required=True)
    ap.add_argument("--batch-token", required=True)
    ap.add_argument("--firebase-key", help="public web API key (not needed with --dev)")
    ap.add_argument("--dev", action="store_true", help="local dev backend: dev sign-in tokens")
    ap.add_argument("--photo", help="a real worksheet photo (names covered) to grade instead of the generated page")
    ap.add_argument("--grade-all", action="store_true", help="also grade the uploads used to reach the Free cap")
    args = ap.parse_args()
    if not args.dev and not args.firebase_key:
        ap.error("--firebase-key is required unless --dev is given")
    try:
        run(args)
    except Exception as exc:
        check("Run completed", False, f"{type(exc).__name__}: {exc}")
    counts = {k: sum(1 for r in RESULTS if r[0] == k) for k in ("PASS", "FAIL", "SKIP")}
    print(f"\n{counts['PASS']} passed, {counts['FAIL']} failed, {counts['SKIP']} skipped")
    for kind, name, detail in RESULTS:
        if kind == "FAIL":
            print(f"  FAILED: {name}" + (f" ({detail})" if detail else ""))
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
