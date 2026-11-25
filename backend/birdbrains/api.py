"""HTTP API (FastAPI). Run locally with ``uvicorn birdbrains.api:app``."""

import hashlib
import hmac
import json
import io
import logging
import os
import secrets
import string
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from PIL import Image

from . import mastery_affect_ledger as ledger_engine
from .billing import Billing, BillingError, plan_change
from .classroom import Classroom, ClassroomError
from .lms import LMS_PROVIDERS, LmsError, LmsProvider, normalize_instance_url
from .upload_errors import READING_REASON_CODES, UPLOAD_ERRORS, UploadFailure, classify_pipeline_error, failure_body
from .auth import Authenticator
from .batch_engine import BatchEngine, FlaggedGrading, is_flagged
from .privacy import PhotoScrubber, make_detector
from .photo_prep import straighten
from .pipeline import ImageRef, Meter, PipelineEngine, SubmissionContext, configure_tracing
from .known_worksheets import apply_known_worksheet
from .questions import segment_questions, split_by_question
from .projections import parent_summary, to_api_grading, to_api_worksheet
from .schemas import (
    STUDENT_ID_PATTERN,
    ApiGrading,
    ApiClass,
    ApiClassroomImport,
    ApiCohortReport,
    ApiLmsProviderStatus,
    ApiLmsSyncResult,
    ApiProgressReport,
    ApiRosterStudent,
    ClassroomImportRequest,
    LmsConnectRequest,
    LmsProviderId,
    LmsSyncRequest,
    ApiUploadTicket,
    ApiUsage,
    CreateUploadRequest,
    ApiParentSummary,
    ApiWorksheet,
    WorksheetContent,
    CreateClassRequest,
    CreateSchoolRequest,
    JoinClassRequest,
    SetPlanRequest,
    SetTesterRequest,
    UpdateProfileRequest,
    CourseEnum,
    LinkChildRequest,
    RegisterRequest,
    ScaffoldingModeEnum,
    Stage1TranscriptionOutput,
    Stage2GradingAndAffectOutput,
    StudentLedger,
    SubmissionIngestionPayload,
    UserProfile,
    TesterViewRequest,
    AddRosterStudentRequest,
)
from .storage import BlobStorage
from .store import Store
from .taxonomy import strand_for

log = logging.getLogger(__name__)

MIN_SHORT_EDGE = 1080  # matches lib/imageQuality.ts
MIN_SHARPNESS_SCORE = 59  # the client's "Too Blurry" cut-off (variance 60) on its 0-100 scale
MAX_FILES = 6
# Extra photos a student adds to an earlier upload (a re-shoot, or close-ups of single
# questions) are read together with the first ones. Capped so one upload stays one page.
MAX_TOTAL_FILES = 10
MAX_ADD_ROUNDS = 3
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_WORKSHEET_ATTEMPTS = 2
UPLOAD_LINK_SECONDS = 15 * 60
_ALNUM = string.ascii_letters + string.digits
# Every self-sign-up family lives in one consumer tenant; schools get their own.
CONSUMER_TENANT = "ten_consumer00"
_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no look-alikes


def new_id(prefix: str) -> str:
    return f"{prefix}_" + "".join(secrets.choice(_ALNUM) for _ in range(12))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Deps:
    store: Store
    storage: BlobStorage
    pipeline: PipelineEngine
    batch: BatchEngine
    auth: Authenticator
    batch_token: Optional[str] = None
    cors_origins: tuple[str, ...] = (
        "https://birdbrain-514606.web.app",
        "https://birdbrain-514606.firebaseapp.com",
        "https://birdbrains.netlify.app",  # old address, kept until Netlify is shut down
        "http://localhost:3000",
    )
    inline_images: bool = False  # local mode: send image bytes to the model, there is no gs:// URI
    scrubber: PhotoScrubber = field(default_factory=PhotoScrubber)
    free_monthly_limit: int = 10  # uploads per student per calendar month on the Free plan
    free_worksheets: bool = False  # nightly 3-stage worksheets are a Pro feature
    billing: Optional[Billing] = None  # Stripe; None = upgrades not configured
    classroom: Optional[Classroom] = None  # Google Classroom OAuth; None = not configured
    lms_providers: dict[str, LmsProvider] = field(default_factory=dict)  # Brightspace, Canvas, Microsoft Edu
    site_url: str = "https://birdbrain-514606.web.app"


def deps_from_env() -> Deps:
    backend = os.environ.get("BIRDBRAINS_BACKEND", "gcp")
    model = os.environ.get("BIRDBRAINS_MODEL", "gemini")
    auth_mode = os.environ.get("BIRDBRAINS_AUTH", "firebase")
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    on_cloud_run = bool(os.environ.get("K_SERVICE"))
    if on_cloud_run and (auth_mode != "firebase" or backend != "gcp"):
        raise RuntimeError("Dev auth and local storage are not allowed on Cloud Run")

    if backend == "gcp":
        from .storage import GcsStorage
        from .store import FirestoreStore

        store = FirestoreStore(project)
        storage = GcsStorage(os.environ["BIRDBRAINS_BUCKET"], project)
    else:
        from .storage import LocalStorage
        from .store import MemoryStore

        store = MemoryStore()
        storage = LocalStorage(os.environ.get("BIRDBRAINS_LOCAL_DIR", ".birdbrains-data"))

    if model == "gemini":
        from .batch_engine import GeminiBatchEngine
        from .pipeline import GeminiPipeline

        pipeline, batch = GeminiPipeline(project), GeminiBatchEngine(storage, project)
    else:
        from .fake import FakeBatchEngine, FakePipeline

        pipeline, batch = FakePipeline(), FakeBatchEngine()

    if auth_mode == "firebase":
        from .auth import FirebaseAuthenticator

        auth = FirebaseAuthenticator(project)
    else:
        from .auth import DevAuthenticator

        auth = DevAuthenticator()

    header = float(os.environ.get("BIRDBRAINS_HEADER_MASK", "0"))
    scrubber = PhotoScrubber(make_detector(project) if backend == "gcp" else None, header_fraction=header)

    env = os.environ.get
    billing = classroom = None
    if env("STRIPE_SECRET_KEY") and env("STRIPE_WEBHOOK_SECRET") and env("STRIPE_PRICE_ID"):
        from .billing import StripeBilling

        billing = StripeBilling(env("STRIPE_SECRET_KEY"), env("STRIPE_WEBHOOK_SECRET"), env("STRIPE_PRICE_ID"))
    if env("BIRDBRAINS_CLASSROOM") == "demo":
        if on_cloud_run:
            raise RuntimeError("The demo Classroom is not allowed on Cloud Run")
        from .demo_classroom import DemoClassroom

        classroom = DemoClassroom(env("BIRDBRAINS_PUBLIC_URL") or "http://localhost:8080")
    elif env("GOOGLE_OAUTH_CLIENT_ID") and env("GOOGLE_OAUTH_CLIENT_SECRET") and env("BIRDBRAINS_PUBLIC_URL"):
        from .classroom import GoogleClassroom

        classroom = GoogleClassroom(env("GOOGLE_OAUTH_CLIENT_ID"), env("GOOGLE_OAUTH_CLIENT_SECRET"),
                                    env("BIRDBRAINS_PUBLIC_URL").rstrip("/") + "/classroom/callback")

    lms_providers: dict[str, LmsProvider] = {}
    pub = env("BIRDBRAINS_PUBLIC_URL")
    if pub:
        pub = pub.rstrip("/")
        if env("BRIGHTSPACE_OAUTH_CLIENT_ID") and env("BRIGHTSPACE_OAUTH_CLIENT_SECRET"):
            from .lms import BrightspaceProvider

            lms_providers["brightspace"] = BrightspaceProvider(
                env("BRIGHTSPACE_OAUTH_CLIENT_ID"),
                env("BRIGHTSPACE_OAUTH_CLIENT_SECRET"),
                f"{pub}/lms/brightspace/callback",
                f"{pub}/auth/lms/brightspace/callback",
            )
        if env("CANVAS_OAUTH_CLIENT_ID") and env("CANVAS_OAUTH_CLIENT_SECRET"):
            from .lms import CanvasProvider

            lms_providers["canvas"] = CanvasProvider(
                env("CANVAS_OAUTH_CLIENT_ID"),
                env("CANVAS_OAUTH_CLIENT_SECRET"),
                f"{pub}/lms/canvas/callback",
                f"{pub}/auth/lms/canvas/callback",
            )
        if env("MICROSOFT_OAUTH_CLIENT_ID") and env("MICROSOFT_OAUTH_CLIENT_SECRET"):
            from .lms import MicrosoftEduProvider

            lms_providers["microsoft_edu"] = MicrosoftEduProvider(
                env("MICROSOFT_OAUTH_CLIENT_ID"),
                env("MICROSOFT_OAUTH_CLIENT_SECRET"),
                f"{pub}/lms/microsoft_edu/callback",
                f"{pub}/auth/lms/microsoft_edu/callback",
            )

    origins = os.environ.get("BIRDBRAINS_CORS_ORIGINS")
    return Deps(
        store=store,
        storage=storage,
        pipeline=pipeline,
        batch=batch,
        auth=auth,
        batch_token=os.environ.get("BIRDBRAINS_BATCH_TOKEN") or None,
        cors_origins=tuple(o.strip() for o in origins.split(",")) if origins else Deps.cors_origins,
        inline_images=backend != "gcp",
        scrubber=scrubber,
        free_monthly_limit=int(os.environ.get("BIRDBRAINS_FREE_MONTHLY_SUBMISSIONS", "10")),
        free_worksheets=os.environ.get("BIRDBRAINS_FREE_WORKSHEETS", "0") == "1",
        billing=billing,
        classroom=classroom,
        lms_providers=lms_providers,
        site_url=(env("BIRDBRAINS_SITE_URL") or Deps.site_url).rstrip("/"),
    )


def create_app(deps: Optional[Deps] = None) -> FastAPI:
    d = deps or deps_from_env()
    configure_tracing()
    app = FastAPI(title="BirdBrains API", version="0.1.0")

    @app.exception_handler(UploadFailure)
    async def upload_failure_handler(request: Request, exc: UploadFailure):
        """Same status and ``detail`` as before, plus the upload failure code and a plain next step."""
        return JSONResponse(failure_body(exc), status_code=exc.status_code, headers=exc.headers)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(d.cors_origins),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # ------------------------------------------------------------- auth helpers
    def current_uid(authorization: Annotated[Optional[str], Header()] = None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Sign in required")
        return d.auth.verify(authorization[7:])

    def current_user(uid: Annotated[str, Depends(current_uid)]) -> dict:
        profile = d.store.get("users", uid)
        if not profile:
            raise HTTPException(403, "PROFILE_REQUIRED")
        return profile

    User = Annotated[dict, Depends(current_user)]

    def require_student_access(user: dict, student_id: str) -> None:
        """Students see themselves; parents see linked children. 404, not 403, so
        that ids cannot be probed."""
        if user["role"] == "teacher":  # teachers see the students they imported from Classroom
            roster = d.store.get("rosters", student_id)
            if not roster or roster["teacherUid"] != user["uid"]:
                raise HTTPException(404, "Not found")
            return
        allowed = [user.get("studentId")] if user["role"] == "student" else user.get("childStudentIds", [])
        if student_id not in allowed:
            raise HTTPException(404, "Not found")

    def tenant_of(doc: dict) -> str:
        return doc.get("tenantId") or CONSUMER_TENANT

    def owned(collection: str, doc_id: str, user: dict) -> dict:
        doc = d.store.get(collection, doc_id)
        if not doc or tenant_of(doc) != tenant_of(user):  # tenant check on every record read
            raise HTTPException(404, "Not found")
        require_student_access(user, doc["studentId"])
        return doc

    # ------------------------------------------------------------------ account
    @app.get("/health")
    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    def profile_view(user: dict) -> dict:
        """The profile as the site sees it: the plan the account acts on, and a
        parent's linked students by name. The stored record is not changed."""
        out = dict(user)
        out["plan"] = account_plan(user)
        if user["role"] == "parent" or user.get("tester"):
            children = []
            for sid in user.get("childStudentIds", []):
                found = d.store.query("users", "studentId", sid)
                if found:
                    children.append({"studentId": sid, "name": found[0]["name"], "course": found[0].get("course")})
            out["children"] = children
        return out

    @app.get("/me", response_model=UserProfile)
    def me(user: User):
        return profile_view(user)

    def ensure_own_student(user: dict, course: Optional[CourseEnum] = None) -> str:
        """Give an account its own student record (id, course, link code) if it has none."""
        if not user.get("studentId"):
            code = "".join(secrets.choice(_CODE_CHARS) for _ in range(8))
            user |= {"studentId": new_id("stu"), "course": (course or CourseEnum("MPM2D")).value, "linkCode": code}
            d.store.put("linkcodes", code, {"studentId": user["studentId"]})
        elif course:
            user["course"] = course.value
        return user["studentId"]

    @app.post("/me/tester-view", response_model=UserProfile)
    def tester_view(body: TesterViewRequest, user: User):
        """Testing accounts switch between the student, parent and teacher views and
        between Free and Pro. All three views show the tester's own uploads: as a
        parent they are linked to themselves, as a teacher they are on their own list."""
        if user.get("tester") is not True:
            raise HTTPException(403, "Only testing accounts can switch views")
        if body.plan:
            user["testerPlan"] = body.plan
        if body.role or body.course:
            sid = ensure_own_student(user, body.course)
            role = body.role or user["role"]
            user["role"] = role
            if role == "parent" and sid not in user.setdefault("childStudentIds", []):
                user["childStudentIds"].append(sid)
            if role == "teacher":
                roster = d.store.get("rosters", sid)
                if not roster or roster.get("teacherUid") != user["uid"]:
                    d.store.put("rosters", sid, {"studentId": sid, "teacherUid": user["uid"], "name": user["name"],
                                                 "course": user["course"], "linkedAccount": True,
                                                 "tenantId": tenant_of(user)})
        d.store.put("users", user["uid"], user)
        return profile_view(user)

    @app.post("/me", response_model=UserProfile)
    def register(body: RegisterRequest, uid: Annotated[str, Depends(current_uid)]):
        existing = d.store.get("users", uid)
        if existing:
            return existing  # role is fixed once chosen
        profile = {"uid": uid, "role": body.role, "name": body.name.strip(), "childStudentIds": [],
                   "tenantId": CONSUMER_TENANT, "classIds": [], "plan": "free", "createdAt": now_iso()}
        if body.role == "student":
            if not body.course:
                raise HTTPException(422, "Students must choose a course")
            code = "".join(secrets.choice(_CODE_CHARS) for _ in range(8))
            profile |= {"studentId": new_id("stu"), "course": body.course.value, "linkCode": code}
            d.store.put("linkcodes", code, {"studentId": profile["studentId"]})
        d.store.put("users", uid, profile)
        return profile

    @app.post("/me/children", response_model=UserProfile)
    def link_child(body: LinkChildRequest, user: User):
        if user["role"] != "parent":
            raise HTTPException(403, "Only parent accounts can link a student")
        link = d.store.get("linkcodes", body.linkCode.strip().upper())
        if not link:
            raise HTTPException(404, "That link code was not recognised")
        if link["studentId"] not in user["childStudentIds"]:
            user["childStudentIds"].append(link["studentId"])
            d.store.put("users", user["uid"], user)
        return profile_view(user)

    def student_profile(student_id: str) -> dict:
        found = d.store.query("users", "studentId", student_id)
        if found:
            return found[0]
        roster = d.store.get("rosters", student_id)  # imported from Classroom: no account of their own
        if not roster:
            raise HTTPException(404, "Not found")
        return roster

    @app.patch("/me", response_model=UserProfile)
    def update_profile(body: UpdateProfileRequest, user: User):
        user["name"] = body.name.strip()
        d.store.put("users", user["uid"], user)
        return profile_view(user)

    # ------------------------------------------------------------ plans + usage
    def linked_accounts(student_id: str) -> list[dict]:
        """The student's own account, parents linked to them, and the teacher who
        imported them from Classroom."""
        accounts = d.store.query("users", "studentId", student_id) + \
            d.store.query_contains("users", "childStudentIds", student_id)
        roster = d.store.get("rosters", student_id)
        if roster and (teacher := d.store.get("users", roster["teacherUid"])):
            accounts.append(teacher)
        return accounts

    def is_tester(student_id: str) -> bool:
        """Testing accounts: no monthly cap, the same photo can be sent again, and
        every Pro feature is on. Only POST /internal/testers (batch token) sets the
        flag; no route a signed-in user can call writes it."""
        return any(a.get("tester") is True for a in linked_accounts(student_id))

    def account_plan(account: dict) -> str:
        """The plan an account acts on. Testing accounts pick Free or Pro themselves
        (POST /me/tester-view) to see both; they are Pro until they pick."""
        if account.get("tester") is True:
            return account.get("testerPlan") or "pro"
        return account.get("plan") or "free"

    def effective_plan(student_id: str) -> str:
        """Pro if the student, a parent linked to them, or the teacher who imported
        them from Classroom is on Pro. A testing account linked to the student
        decides alone (its Free/Pro switch), so a tester can see the Free view."""
        accounts = linked_accounts(student_id)
        testers = [a for a in accounts if a.get("tester") is True]
        if testers:
            return "pro" if any(account_plan(a) == "pro" for a in testers) else "free"
        return "pro" if any(account_plan(a) == "pro" for a in accounts) else "free"

    def usage(student_id: str) -> ApiUsage:
        now = datetime.now(timezone.utc)
        month = now.strftime("%Y-%m")
        used = sum(1 for s in d.store.query("submissions", "studentId", student_id)
                   if s["uploadedAt"].startswith(month))
        plan = effective_plan(student_id)
        # Testers on the Free view see the meter but never hit the cap (see ingest).
        limit = d.free_monthly_limit if plan == "free" and not is_tester(student_id) else None
        nxt = datetime(now.year + (now.month == 12), now.month % 12 + 1, 1, tzinfo=timezone.utc)
        return ApiUsage(studentId=student_id, plan=plan, monthlyLimit=limit, usedThisMonth=used,
                        remaining=None if limit is None else max(limit - used, 0), resetsAt=nxt.isoformat())

    @app.get("/students/{student_id}/usage", response_model=ApiUsage)
    def get_usage(student_id: str, user: User):
        require_student_access(user, student_id)
        return usage(student_id)

    # ------------------------------------------------------- classes (students)
    def class_view(cls: dict) -> ApiClass:
        school = d.store.get("schools", cls["schoolId"]) or {}
        return ApiClass(classId=cls["classId"], className=cls["className"], gradeLevel=cls["gradeLevel"],
                        schoolId=cls["schoolId"], schoolName=school.get("schoolName", ""))

    @app.get("/me/classes", response_model=list[ApiClass])
    def my_classes(user: User):
        return [class_view(c) for cid in user.get("classIds", []) if (c := d.store.get("classes", cid))]

    @app.post("/me/classes", response_model=list[ApiClass])
    def join_class(body: JoinClassRequest, user: User):
        if user["role"] != "student":
            raise HTTPException(403, "Only student accounts can join a class")
        link = d.store.get("joincodes", body.joinCode.strip().upper())
        cls = link and d.store.get("classes", link["classId"])
        if not cls:
            raise HTTPException(404, "That class code was not recognised")
        if cls["classId"] not in user.setdefault("classIds", []):
            user["classIds"].append(cls["classId"])
            d.store.put("users", user["uid"], user)
        return my_classes(user)

    @app.delete("/me/classes/{class_id}", response_model=list[ApiClass])
    def leave_class(class_id: str, user: User):
        if class_id in user.get("classIds", []):
            user["classIds"].remove(class_id)
            d.store.put("users", user["uid"], user)
        return my_classes(user)

    # ------------------------------------------------------- delete my data
    def purge_student(student_id: str) -> None:
        """Remove every record and photo for one student, their account and links."""
        for sub in d.store.query("submissions", "studentId", student_id):
            for f in sub.get("files", []):
                if f.get("sha256"):
                    d.store.delete("imagehashes", f"{student_id}_{f['sha256']}")
            d.store.delete("transcriptions", sub["submissionId"])
            d.store.delete("submissions", sub["submissionId"])
        d.storage.delete_prefix(f"submissions/{student_id}/")
        for g in d.store.query("gradings", "studentId", student_id):
            d.store.delete("worksheets", g["gradingId"])
            d.store.delete("gradings", g["gradingId"])
        d.store.delete("ledgers", student_id)
        for c in d.store.query("usagecounters", "studentId", student_id):
            d.store.delete("usagecounters", f"{student_id}_{c['month']}")
        d.store.delete("rosters", student_id)
        for parent in d.store.query_contains("users", "childStudentIds", student_id):
            parent["childStudentIds"].remove(student_id)
            d.store.put("users", parent["uid"], parent)
        for profile in d.store.query("users", "studentId", student_id):
            if profile.get("linkCode"):
                d.store.delete("linkcodes", profile["linkCode"])
            d.store.delete("users", profile["uid"])
            d.auth.delete_user(profile["uid"])

    @app.delete("/students/{student_id}", status_code=204)
    def delete_student_data(student_id: str, user: User):
        """A student deletes themselves, or a linked parent deletes their child."""
        require_student_access(user, student_id)
        purge_student(student_id)
        return Response(status_code=204)

    @app.delete("/me", status_code=204)
    def delete_me(user: User):
        if user["role"] == "student":
            purge_student(user["studentId"])
        else:
            if user["role"] == "teacher":
                for r in d.store.query("rosters", "teacherUid", user["uid"]):
                    if d.store.query("users", "studentId", r["studentId"]):
                        d.store.delete("rosters", r["studentId"])  # has their own account: keep it
                    else:
                        purge_student(r["studentId"])
                disconnect_classroom(user)
                for pid in LMS_PROVIDERS:
                    disconnect_lms(user, pid)
            d.store.delete("users", user["uid"])
            d.auth.delete_user(user["uid"])
        return Response(status_code=204)

    # -------------------------------------------------------------- submissions
    @app.post("/submissions", response_model=SubmissionIngestionPayload, status_code=201)
    def create_submission(
        user: User,
        studentId: Annotated[str, Form(pattern=STUDENT_ID_PATTERN)],
        sharpnessScore: Annotated[float, Form(ge=0, le=100)],
        files: Annotated[list[UploadFile], File()],
        # Optional: students just upload. The reading step works out the course, unit
        # and topic from the page (see process_submission).
        course: Annotated[Optional[CourseEnum], Form()] = None,
        unitTopic: Annotated[str, Form(max_length=200)] = "",
    ):
        require_student_access(user, studentId)
        if not 1 <= len(files) <= MAX_FILES:
            raise UploadFailure(422, 107, f"Attach between 1 and {MAX_FILES} photos")
        blobs = [upload.file.read(MAX_FILE_BYTES + 1) for upload in files]
        course = course or CourseEnum(user.get("course") or CourseEnum.MPM2D.value)
        return ingest(user["uid"], tenant_of(user), studentId, course, unitTopic, sharpnessScore, blobs)

    def check_photos(blobs: list[bytes], first_index: int = 0):
        """Size, format and resolution checks. Returns (index, bytes, mime, ext, sha256)
        per photo and the smallest photo's size."""
        stored, smallest = [], None
        for i, data in enumerate(blobs, start=first_index):
            if len(data) > MAX_FILE_BYTES:
                raise UploadFailure(413, 106, "Each photo must be 12 MB or smaller")
            try:
                with Image.open(io.BytesIO(data)) as img:
                    fmt, (w, h) = img.format, img.size
                    img.verify()
            except Exception:
                raise UploadFailure(422, 104, "One of the files is not a readable image")
            if fmt not in ALLOWED_TYPES:
                raise UploadFailure(422, 105, "Photos must be JPEG, PNG or WebP")
            if min(w, h) < MIN_SHORT_EDGE:
                raise UploadFailure(422, 102, f"Photo {i + 1} is below 1080p ({w}x{h}). Please retake it.")
            if smallest is None or min(w, h) < min(smallest):
                smallest = (w, h)
            stored.append((i, data, ALLOWED_TYPES[fmt], fmt.lower(), hashlib.sha256(data).hexdigest()))
        return stored, smallest

    def store_photos(studentId: str, submission_id: str, stored: list) -> list[dict]:
        """Straighten, scrub names, then store. Raises UploadFailure on a scrub error."""
        records = []
        for i, data, mime, ext, sha in stored:
            # Angled shots are flattened to a straight top-down page first; the stored
            # photo is the straightened one, so the reading step and the viewer agree.
            data = straighten(data, ext)
            try:
                data = d.scrubber.scrub(data, ext.upper())  # names and EXIF removed before storage
            except Exception:
                log.exception("Photo scrubbing failed")
                raise UploadFailure(503, 302, "We could not check the photo for names. Please try again.")
            path = f"submissions/{studentId}/{submission_id}/{i}.{ext}"
            uri = d.storage.write_bytes(path, data, mime)
            records.append({"path": path, "uri": uri, "mimeType": mime, "sha256": sha})
        return records

    def ingest(uid: str, tenant_id: str, studentId: str, course: CourseEnum, unitTopic: str,
               sharpnessScore: Optional[float], blobs: list[bytes],
               source: str = "web") -> SubmissionIngestionPayload:
        """Shared by the web upload and the extension's one-time upload link: plan
        limit, image checks, duplicate check, privacy scrub, then storage."""
        if usage(studentId).remaining == 0:
            raise UploadFailure(402, 402, "FREE_LIMIT_REACHED")
        submission_id = new_id("sub")
        stored, smallest = check_photos(blobs)
        # Classroom imports come with no browser sharpness score; unreadable pages are
        # caught by Stage 1 (NEEDS_RETAKE) instead.
        if sharpnessScore is not None and sharpnessScore < MIN_SHARPNESS_SCORE:
            raise UploadFailure(422, 101, "The photo is too blurry. Please retake it.")
        # UT-06: the exact same photo uploaded again for this student is a 409, and
        # the pipeline is not run a second time. Location points at the original.
        # Testing accounts may resend a photo to grade it again.
        for i, *_, sha in ([] if is_tester(studentId) else stored):
            seen = d.store.get("imagehashes", f"{studentId}_{sha}")
            if seen:
                raise UploadFailure(
                    409, 108, f"Photo {i + 1} was already uploaded. Open your earlier diagnostic instead.",
                    headers={"Location": f"/submissions/{seen['submissionId']}"})

        # Take this month's slot in one atomic step, so uploads sent at the same
        # instant cannot both squeeze under the Free cap. The slot is given back if
        # the upload fails after this point.
        current = usage(studentId)
        counter_id = f"{studentId}_{datetime.now(timezone.utc):%Y-%m}"
        if not d.store.add_to_counter("usagecounters", counter_id, 1, limit=current.monthlyLimit,
                                      seed=current.usedThisMonth,
                                      fields={"studentId": studentId, "month": counter_id[-7:]}):
            raise UploadFailure(402, 402, "FREE_LIMIT_REACHED")
        try:
            file_records = store_photos(studentId, submission_id, stored)
        except Exception:
            d.store.add_to_counter("usagecounters", counter_id, -1)
            raise
        record = {
            "submissionId": submission_id,
            "studentId": studentId,
            "course": course.value,
            "unitTopic": unitTopic.strip(),
            "imageResolution": {"width": smallest[0], "height": smallest[1]},
            "sharpnessScore": sharpnessScore,
            "isQualityPassed": True,
            "uploadedAt": now_iso(),
            "files": file_records,
            "status": "UPLOADED",
            "gradingId": None,
            "uploadedBy": uid,
            "tenantId": tenant_id,
            "source": source,
        }
        d.store.put("submissions", submission_id, record)
        for *_, sha in stored:
            d.store.put("imagehashes", f"{studentId}_{sha}", {"studentId": studentId, "submissionId": submission_id})
        return submission_payload(record)

    # ------------------------------------- one-time upload links (Chrome extension)
    @app.post("/uploads", response_model=ApiUploadTicket, status_code=201)
    def create_upload_ticket(body: CreateUploadRequest, user: User):
        """Step 1 for the extension: get a link that accepts one photo for 15 minutes
        without the sign-in token (so a content script never has to hold it)."""
        require_student_access(user, body.studentId)
        if usage(body.studentId).remaining == 0:
            raise UploadFailure(402, 402, "FREE_LIMIT_REACHED")
        upload_id, token = new_id("upl"), secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(seconds=UPLOAD_LINK_SECONDS)
        d.store.put("uploadtickets", upload_id, {
            "uploadId": upload_id, "tokenHash": hashlib.sha256(token.encode()).hexdigest(),
            "expiresAt": expires.isoformat(), "uid": user["uid"], "tenantId": tenant_of(user),
            "studentId": body.studentId, "course": body.course.value, "unitTopic": body.unitTopic.strip(),
            "sharpnessScore": body.sharpnessScore, "submissionId": None,
        })
        return ApiUploadTicket(uploadId=upload_id, uploadUrl=f"/uploads/{upload_id}/file?token={token}",
                               method="PUT", expiresAt=expires.isoformat(), maxBytes=MAX_FILE_BYTES)

    @app.put("/uploads/{upload_id}/file", response_model=SubmissionIngestionPayload, status_code=201)
    async def put_upload(upload_id: str, token: str, request: Request):
        """Step 2: PUT the raw image bytes. The link works once."""
        ticket = d.store.get("uploadtickets", upload_id)
        if (not ticket or ticket["submissionId"]
                or not hmac.compare_digest(ticket["tokenHash"], hashlib.sha256(token.encode()).hexdigest())):
            raise HTTPException(404, "Not found")
        if datetime.fromisoformat(ticket["expiresAt"]) < datetime.now(timezone.utc):
            raise UploadFailure(410, 304, "UPLOAD_LINK_EXPIRED")
        if int(request.headers.get("content-length") or 0) > MAX_FILE_BYTES:
            raise UploadFailure(413, 106, "Each photo must be 12 MB or smaller")
        data = await request.body()
        payload = await run_in_threadpool(
            ingest, ticket["uid"], ticket["tenantId"], ticket["studentId"], CourseEnum(ticket["course"]),
            ticket["unitTopic"], ticket["sharpnessScore"], [data], "extension")
        ticket["submissionId"] = payload.submissionId
        d.store.put("uploadtickets", upload_id, ticket)
        return payload

    def submission_payload(record: dict) -> SubmissionIngestionPayload:
        urls = [f"/submissions/{record['submissionId']}/files/{i}" for i in range(len(record["files"]))]
        return SubmissionIngestionPayload(**{k: v for k, v in record.items() if k not in ("files", "uploadedBy", "tenantId", "source")},
                                          fileUrls=urls)

    @app.get("/submissions/{submission_id}", response_model=SubmissionIngestionPayload)
    def get_submission(submission_id: str, user: User):
        return submission_payload(owned("submissions", submission_id, user))

    @app.get("/submissions/{submission_id}/files/{index}")
    def get_submission_file(submission_id: str, index: int, user: User):
        record = owned("submissions", submission_id, user)
        if not 0 <= index < len(record["files"]):
            raise HTTPException(404, "Not found")
        f = record["files"][index]
        try:
            data = d.storage.read_bytes(f["path"])
        except Exception:
            raise UploadFailure(410, 303, "PHOTO_EXPIRED")  # raw photos are deleted after 90 days
        # Photos are only served through this signed-in route; browsers keep them 15 minutes at most.
        return Response(data, media_type=f["mimeType"], headers={"Cache-Control": "private, max-age=900"})

    @app.post("/submissions/{submission_id}/process")
    def process_submission(submission_id: str, user: User):
        """Run Stage 1 then Stage 2 and update the ledger. Synchronous and
        idempotent: calling it again returns the existing grading."""
        record = owned("submissions", submission_id, user)
        if record["status"] == "GRADED":
            return {"submission": submission_payload(record),
                    "grading": to_api_grading(d.store.get("gradings", record["gradingId"]))}
        return run_pipeline(record)

    @app.post("/submissions/{submission_id}/regrade")
    def regrade_submission(submission_id: str, user: User):
        """Testing accounts: read and grade an earlier upload again with the current
        pipeline. The new grading replaces the old one (and its worksheet). The ledger
        is left alone, so the same work never counts twice."""
        record = owned("submissions", submission_id, user)
        if not is_tester(record["studentId"]):
            raise HTTPException(403, "TESTERS_ONLY")
        if record["status"] in ("TRANSCRIBING", "GRADING"):
            raise HTTPException(409, "ALREADY_RUNNING")
        d.store.delete("transcriptions", submission_id)
        return run_pipeline(record, regrade=True)

    @app.post("/submissions/{submission_id}/photos")
    def add_photos(
        submission_id: str,
        user: User,
        files: Annotated[list[UploadFile], File()],
        sharpnessScore: Annotated[Optional[float], Form(ge=0, le=100)] = None,
    ):
        """Add photos of the same worksheet to an earlier upload: a clearer re-shoot,
        or close-ups of single questions. The page is read again from all of its photos
        together and the grading is replaced. The same photo may be sent again. It
        does not use a monthly upload, and the ledger is not counted twice."""
        record = owned("submissions", submission_id, user)
        if record["status"] in ("TRANSCRIBING", "GRADING"):
            raise HTTPException(409, "ALREADY_RUNNING")
        if record.get("addedPhotoRounds", 0) >= MAX_ADD_ROUNDS:
            raise UploadFailure(422, 107, f"This upload already has photos added {MAX_ADD_ROUNDS} times. Start a new upload instead.")
        if not 1 <= len(files) <= MAX_TOTAL_FILES - len(record["files"]):
            raise UploadFailure(422, 107, f"An upload can hold at most {MAX_TOTAL_FILES} photos.")
        blobs = [upload.file.read(MAX_FILE_BYTES + 1) for upload in files]
        stored, _ = check_photos(blobs, first_index=len(record["files"]))
        if sharpnessScore is not None and sharpnessScore < MIN_SHARPNESS_SCORE:
            raise UploadFailure(422, 101, "The photo is too blurry. Please retake it.")
        record["files"] = record["files"] + store_photos(record["studentId"], submission_id, stored)
        record["addedPhotoRounds"] = record.get("addedPhotoRounds", 0) + 1
        d.store.put("submissions", submission_id, record)
        d.store.delete("transcriptions", submission_id)
        return run_pipeline(record, regrade=record.get("gradingId") is not None)

    def run_pipeline(record: dict, regrade: bool = False) -> dict:
        submission_id = record["submissionId"]
        old_grading_id = record.get("gradingId") if regrade else None

        def set_status(status: str, **extra):
            record.update(status=status, **extra)
            d.store.put("submissions", submission_id, record)

        ctx = SubmissionContext(submission_id, CourseEnum(record["course"]), record["unitTopic"])
        student_id = record["studentId"]
        plan = effective_plan(student_id)
        meter = Meter()
        try:
            cached = d.store.get("transcriptions", submission_id)
            if cached:
                stage1 = Stage1TranscriptionOutput.model_validate(cached)
            else:
                set_status("TRANSCRIBING")
                images = [
                    ImageRef(f["uri"], f["mimeType"], d.storage.read_bytes(f["path"]) if d.inline_images else None)
                    for f in record["files"]
                ]
                stage1 = d.pipeline.run_stage1(ctx, images, meter=meter)
                d.store.put("transcriptions", submission_id, stage1.model_dump(mode="json"))
            if stage1.requires_hitl:
                set_status("NEEDS_RETAKE", failureCode=READING_REASON_CODES.get(stage1.unreadable_reason or "", 201))
                return {"submission": submission_payload(record), "grading": None}
            # Fill the course and topic from what the page showed, unless the upload
            # already carried them (extension, Classroom, older clients).
            read_topic = " · ".join(t for t in (stage1.detected_unit, stage1.detected_topic) if t)
            if not record["unitTopic"].strip() and read_topic:
                record["unitTopic"] = read_topic[:200]
            if stage1.detected_course:
                record["course"] = stage1.detected_course
            ctx = SubmissionContext(submission_id, CourseEnum(record["course"]), record["unitTopic"] or "Not stated")

            set_status("GRADING")
            stage1 = segment_questions(stage1)  # two numbered questions read as one are split
            stage1 = apply_known_worksheet(stage1)  # printed questions of a known BB-W sheet
            stage2 = d.pipeline.run_stage2(ctx, stage1, plan=plan, meter=meter)
            stage2 = split_by_question(stage1, stage2)
        except HTTPException:
            raise
        except Exception as e:
            log.exception("Pipeline failed for %s", submission_id)
            # One JSON line the logs can be searched for. The text is Google's error
            # (model, region, status), never the student's work.
            print(json.dumps({"severity": "ERROR", "event": "pipeline_failed", "submissionId": submission_id,
                              "error": type(e).__name__, "message": str(e)[:400]}), flush=True)
            code = classify_pipeline_error(e)
            set_status("FAILED", failureCode=code)
            raise UploadFailure(502, code, "The diagnostic could not be completed. Please try again.")

        strand = strand_for(ctx.course, ctx.unit_topic)
        stored_ledger = d.store.get("ledgers", student_id)
        before = StudentLedger.model_validate(stored_ledger) if stored_ledger else StudentLedger(student_id=student_id)
        if plan == "free":
            # Free plan: no affect telemetry is kept, and mood never changes the scaffolding mode.
            clean_questions = [
                q.model_copy(update={
                    "sentiment_entities": [],
                    "aggregate_valence": 0.0,
                    "aggregate_friction": 0.0,
                    "recommended_scaffolding_mode": ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE,
                })
                for q in stage2.question_analyses
            ]
            stage2 = stage2.model_copy(update={"question_analyses": clean_questions,
                                               "sentiment_entities": [], "aggregate_valence": 0.0,
                                               "aggregate_friction": 0.0})
        ledger = ledger_engine.apply_observation(before, stage2, strand)
        if plan == "free":
            ledger = ledger.model_copy(update={"valence_ewma": before.valence_ewma,
                                               "scaffolding_mode": before.scaffolding_mode})
        if not regrade:
            d.store.put("ledgers", student_id, ledger.model_dump(mode="json"))

        grading_id = new_id("grd")
        grading = {
            "gradingId": grading_id,
            "submissionId": submission_id,
            "studentId": student_id,
            "course": record["course"],
            "unitTopic": record["unitTopic"],
            "strand": strand,
            "gradedAt": now_iso(),
            # The ledger's mode (history-aware) wins over the model's single-submission suggestion.
            "scaffoldingMode": ledger.scaffolding_mode.value if plan == "pro" else "STANDARD_PROGRESSIVE_FADE",
            "plan": plan,
            "stage2": stage2.model_dump(mode="json"),
            "worksheetStatus": ("NOT_NEEDED" if not is_flagged(stage2)
                                else "QUEUED" if plan == "pro" or d.free_worksheets else "PRO_ONLY"),
            "worksheetAttempts": 0,
            "tenantId": tenant_of(record),
            "cost": meter.summary(),  # internal: never returned by the API
        }
        d.store.put("gradings", grading_id, grading)
        set_status("GRADED", gradingId=grading_id, failureCode=None)
        if old_grading_id and old_grading_id != grading_id:
            d.store.delete("gradings", old_grading_id)
            d.store.delete("worksheets", old_grading_id)
        # One JSON line per graded upload on stdout, which Cloud Run stores as a
        # structured log entry. The cost and speed charts and alerts are built from
        # it (backend/monitoring.sh). Ids only, never names.
        print(json.dumps({"severity": "INFO", "event": "pipeline_done", "plan": plan, "submissionId": submission_id,
                          "usd": grading["cost"]["usd"], "seconds": grading["cost"]["seconds"]}), flush=True)
        return {"submission": submission_payload(record), "grading": to_api_grading(grading)}

    # ------------------------------------------------------- student dashboard
    def student_gradings(student_id: str) -> list[dict]:
        return sorted(d.store.query("gradings", "studentId", student_id), key=lambda g: g["gradedAt"], reverse=True)

    @app.get("/students/{student_id}/gradings", response_model=list[ApiGrading])
    def list_gradings(student_id: str, user: User):
        require_student_access(user, student_id)
        return [to_api_grading(g) for g in student_gradings(student_id)[:50]]

    @app.get("/students/{student_id}/gradings/latest", response_model=ApiGrading)
    def latest_grading(student_id: str, user: User):
        require_student_access(user, student_id)
        gradings = student_gradings(student_id)
        if not gradings:
            raise HTTPException(404, "NO_GRADED_WORK")
        return to_api_grading(gradings[0])

    @app.get("/gradings/{grading_id}", response_model=ApiGrading)
    def get_grading(grading_id: str, user: User):
        return to_api_grading(owned("gradings", grading_id, user))

    @app.get("/gradings/{grading_id}/worksheet", response_model=ApiWorksheet)
    def get_worksheet(grading_id: str, user: User):
        grading = owned("gradings", grading_id, user)
        if grading["worksheetStatus"] != "READY":
            # QUEUED / PENDING: generated overnight. NOT_NEEDED: no errors. FAILED.
            raise HTTPException(404, f"WORKSHEET_{grading['worksheetStatus']}")
        return to_api_worksheet(d.store.get("worksheets", grading_id))

    @app.post("/gradings/{grading_id}/worksheet/generate", response_model=ApiWorksheet)
    def generate_worksheet(grading_id: str, user: User, remake: bool = False):
        """Make the practice worksheet now instead of waiting for the nightly job. Pro
        (and testing accounts) only. A ready worksheet is returned as it is, so pressing
        twice costs nothing. If this fails the worksheet stays queued for the night."""
        grading = owned("gradings", grading_id, user)
        status = grading["worksheetStatus"]
        if status == "READY" and not (remake and is_tester(grading["studentId"])):
            return to_api_worksheet(d.store.get("worksheets", grading_id))  # testers may remake it
        if status == "NOT_NEEDED":
            raise HTTPException(409, "WORKSHEET_NOT_NEEDED")
        if status == "PRO_ONLY" or (effective_plan(grading["studentId"]) != "pro" and not d.free_worksheets):
            raise HTTPException(402, "PRO_ONLY")
        item = FlaggedGrading(
            grading_id=grading_id,
            course=CourseEnum(grading["course"]),
            unit_topic=grading["unitTopic"],
            scaffolding_mode=ScaffoldingModeEnum(grading["scaffoldingMode"]),
            stage2=Stage2GradingAndAffectOutput.model_validate(grading["stage2"]),
        )
        try:
            # Sections A to C now; the site then asks .../worksheet/practice for section D.
            content = d.batch.generate_now(item, core_only=True)
        except Exception as exc:
            log.warning("On-demand worksheet failed for %s: %s", grading_id, str(exc)[:300])
            if status == "FAILED":  # the night already gave up; give it another go
                grading.update(worksheetStatus="QUEUED", worksheetAttempts=0)
                d.store.put("gradings", grading_id, grading)
            raise HTTPException(502, "WORKSHEET_NOT_MADE")
        record = {
            "worksheetId": new_id("wks"), "gradingId": grading_id, "studentId": grading["studentId"],
            "createdAt": now_iso(), "content": content.model_dump(mode="json"), "tenantId": tenant_of(grading),
        }
        d.store.put("worksheets", grading_id, record)
        grading["worksheetStatus"] = "READY"
        d.store.put("gradings", grading_id, grading)
        return to_api_worksheet(record)

    @app.post("/gradings/{grading_id}/worksheet/practice", response_model=ApiWorksheet)
    def generate_practice_set(grading_id: str, user: User):
        """Add the 8-problem practice set (section D) to a ready worksheet that has none:
        one made by "Make it now" (which answers with sections A to C first) or an older
        one. A worksheet that already has its set is returned as it is."""
        grading = owned("gradings", grading_id, user)
        record = d.store.get("worksheets", grading_id) if grading["worksheetStatus"] == "READY" else None
        if not record:
            raise HTTPException(404, "WORKSHEET_NOT_READY")
        core = WorksheetContent.model_validate(record["content"])
        if core.practice_set:
            return to_api_worksheet(record)
        if effective_plan(grading["studentId"]) != "pro" and not d.free_worksheets:
            raise HTTPException(402, "PRO_ONLY")
        item = FlaggedGrading(
            grading_id=grading_id,
            course=CourseEnum(grading["course"]),
            unit_topic=grading["unitTopic"],
            scaffolding_mode=ScaffoldingModeEnum(grading["scaffoldingMode"]),
            stage2=Stage2GradingAndAffectOutput.model_validate(grading["stage2"]),
        )
        try:
            practice = d.batch.generate_practice(item, core)
        except Exception as exc:
            log.warning("Practice set failed for %s: %s", grading_id, str(exc)[:300])
            raise HTTPException(502, "PRACTICE_NOT_MADE")
        latest = d.store.get("worksheets", grading_id) or record  # a second tab may have added it
        if not WorksheetContent.model_validate(latest["content"]).practice_set:
            latest["content"]["practice_set"] = [p.model_dump(mode="json") for p in practice]
            d.store.put("worksheets", grading_id, latest)
        return to_api_worksheet(latest)

    @app.get("/gradings/{grading_id}/worksheet.pdf")
    def get_worksheet_pdf(grading_id: str, user: User):
        """The 3-stage worksheet as a printable PDF (rendered on request)."""
        from .worksheet_pdf import render_pdf

        ws = get_worksheet(grading_id, user)
        return Response(render_pdf(ws), media_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="birdbrains-worksheet-{grading_id}.pdf"',
            "Cache-Control": "private, max-age=900"})

    # -------------------------------------------------------- parent dashboard
    @app.get("/students/{student_id}/parent-summary", response_model=ApiParentSummary)
    def get_parent_summary(student_id: str, user: User):
        require_student_access(user, student_id)
        stored = d.store.get("ledgers", student_id)
        ledger = StudentLedger.model_validate(stored) if stored else StudentLedger(student_id=student_id)
        summary = parent_summary(student_profile(student_id), ledger, student_gradings(student_id),
                                 include_affect=effective_plan(student_id) == "pro")
        if summary is None:
            raise HTTPException(404, "NO_GRADED_WORK")
        return summary

    # ------------------------------------------------------- billing (Stripe)
    @app.post("/billing/checkout")
    def billing_checkout(user: User):
        """Start a Pro subscription: returns the Stripe Checkout URL to send the browser to."""
        if not d.billing:
            raise HTTPException(503, "BILLING_NOT_CONFIGURED")
        if user.get("plan") == "pro":
            raise HTTPException(409, "ALREADY_PRO")
        try:
            url = d.billing.checkout_url(user["uid"], user.get("stripeCustomerId"),
                                         f"{d.site_url}/account?upgrade=success", f"{d.site_url}/account?upgrade=cancelled")
        except BillingError:
            log.exception("Stripe checkout failed")
            raise HTTPException(502, "Checkout could not be started. Please try again.")
        return {"url": url}

    @app.post("/billing/portal")
    def billing_portal(user: User):
        """Manage or cancel: returns the Stripe customer portal URL."""
        if not d.billing:
            raise HTTPException(503, "BILLING_NOT_CONFIGURED")
        if not user.get("stripeCustomerId"):
            raise HTTPException(404, "NO_SUBSCRIPTION")
        try:
            return {"url": d.billing.portal_url(user["stripeCustomerId"], f"{d.site_url}/account")}
        except BillingError:
            log.exception("Stripe portal failed")
            raise HTTPException(502, "The billing page could not be opened. Please try again.")

    @app.post("/billing/webhook")
    async def billing_webhook(request: Request, stripe_signature: Annotated[Optional[str], Header()] = None):
        """Called by Stripe. The signed event is the only thing that changes a plan."""
        if not d.billing:
            raise HTTPException(503, "BILLING_NOT_CONFIGURED")
        try:
            event = d.billing.parse_webhook(await request.body(), stripe_signature or "")
        except BillingError:
            raise HTTPException(400, "Invalid signature")
        change = plan_change(event)
        if change:
            uid, customer, plan = change
            profile = d.store.get("users", uid) if uid else None
            if not profile and customer:
                profile = next(iter(d.store.query("users", "stripeCustomerId", customer)), None)
            # Ignore events about a different customer than the one on file (e.g. an old subscription).
            if profile and (not profile.get("stripeCustomerId") or profile["stripeCustomerId"] == customer
                            or plan == "pro"):
                profile.update(plan=plan, stripeCustomerId=customer or profile.get("stripeCustomerId"))
                d.store.put("users", profile["uid"], profile)
                log.info("Plan for %s set to %s by Stripe event %s", profile["uid"], plan, event.get("type"))
        return {"received": True}

    # --------------------------------------------- Google Classroom (Pro teachers)
    def classroom_teacher(user: dict) -> dict:
        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts can use Google Classroom")
        if account_plan(user) != "pro":
            raise HTTPException(402, "PRO_ONLY")
        if not d.classroom:
            raise HTTPException(503, "CLASSROOM_NOT_CONFIGURED")
        return user

    def classroom_session(user: dict):
        tokens = d.store.get("googletokens", classroom_teacher(user)["uid"])
        if not tokens:
            raise HTTPException(409, "CLASSROOM_NOT_CONNECTED")
        try:
            return d.classroom.open(tokens["refreshToken"])
        except ClassroomError:
            d.store.delete("googletokens", user["uid"])  # access was revoked on Google's side
            raise HTTPException(409, "CLASSROOM_NOT_CONNECTED")

    def disconnect_classroom(user: dict) -> None:
        tokens = d.store.get("googletokens", user["uid"])
        if tokens:
            if d.classroom:
                d.classroom.revoke(tokens["refreshToken"])
            d.store.delete("googletokens", user["uid"])

    def google(call):
        try:
            return call()
        except ClassroomError as e:
            log.warning("Google Classroom call failed: %s", e)
            raise HTTPException(502, "Google Classroom could not be reached. Please try again.")

    @app.get("/classroom/status")
    def classroom_status(user: User):
        return {"configured": d.classroom is not None, "plan": account_plan(user),
                "connected": d.store.get("googletokens", user["uid"]) is not None}

    @app.post("/classroom/connect")
    def classroom_connect(user: User):
        """Returns the Google consent URL. Google sends the teacher back to /classroom/callback."""
        classroom_teacher(user)
        state = secrets.token_urlsafe(32)
        d.store.put("oauthstates", state, {"uid": user["uid"], "expiresAt":
                    (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()})
        return {"url": d.classroom.auth_url(state)}

    @app.get("/classroom/callback")
    def classroom_callback(state: str = "", code: str = "", error: str = ""):
        back = f"{d.site_url}/teacher?classroom="
        pending = d.store.get("oauthstates", state) if state else None
        if state:
            d.store.delete("oauthstates", state)
        if (not pending or not d.classroom or not code or error
                or datetime.fromisoformat(pending["expiresAt"]) < datetime.now(timezone.utc)):
            return RedirectResponse(back + "failed", status_code=303)
        try:
            refresh = d.classroom.exchange(code)
        except ClassroomError:
            return RedirectResponse(back + "failed", status_code=303)
        d.store.put("googletokens", pending["uid"], {"uid": pending["uid"], "refreshToken": refresh,
                                                     "connectedAt": now_iso()})
        return RedirectResponse(back + "connected", status_code=303)

    @app.delete("/classroom", status_code=204)
    def classroom_disconnect(user: User):
        disconnect_classroom(user)
        return Response(status_code=204)

    @app.get("/classroom/courses")
    def classroom_courses(user: User):
        sess = classroom_session(user)
        return google(sess.courses)

    @app.get("/classroom/courses/{course_id}/coursework")
    def classroom_coursework(course_id: str, user: User):
        sess = classroom_session(user)
        return google(lambda: sess.coursework(course_id))

    @app.post("/classroom/courses/{course_id}/coursework/{work_id}/import", response_model=ApiClassroomImport)
    def classroom_import(course_id: str, work_id: str, body: ClassroomImportRequest, user: User):
        """Pull the photos students handed in for one assignment into BirdBrains.
        Each becomes a submission (not yet graded): call /submissions/{id}/process for each."""
        sess = classroom_session(user)
        names = google(lambda: sess.student_names(course_id))
        handed_in = google(lambda: sess.submissions(course_id, work_id))
        imported, skipped = [], []
        for sub in handed_in:
            name = names.get(sub["userId"], "Student")
            if sub.get("state") not in ("TURNED_IN", "RETURNED"):
                skipped.append({"studentName": name, "reason": "Not handed in yet"})
                continue
            blobs = []
            for f in sub["files"][:MAX_FILES]:
                try:
                    blobs.append(sess.download(f["id"])[0])
                except ClassroomError:
                    pass  # not a photo, too large, or not shared with the teacher
            if not blobs:
                skipped.append({"studentName": name, "reason": "No photo attached (JPEG, PNG or WebP)"})
                continue
            key = f"{user['uid']}:{sub['userId']}"
            roster = next(iter(d.store.query("rosters", "googleKey", key)), None)
            if not roster:
                roster = {"studentId": new_id("stu"), "teacherUid": user["uid"], "googleKey": key,
                          "googleCourseId": course_id, "tenantId": tenant_of(user), "createdAt": now_iso()}
            roster.update(name=name, course=body.course.value)
            d.store.put("rosters", roster["studentId"], roster)
            try:
                payload = ingest(user["uid"], tenant_of(user), roster["studentId"], body.course,
                                 body.unitTopic, None, blobs, "classroom")
            except HTTPException as e:
                reason = "Already imported" if e.status_code == 409 else str(e.detail)
                skipped.append({"studentName": name, "reason": reason})
                continue
            imported.append({"studentId": roster["studentId"], "studentName": name,
                             "submissionId": payload.submissionId})
            d.store.put("lmsimports", payload.submissionId, {
                "submissionId": payload.submissionId,
                "teacherUid": user["uid"],
                "studentId": roster["studentId"],
                "studentName": name,
                "provider": "google_classroom",
                "courseId": course_id,
                "assignmentId": work_id,
                "lmsUserId": sub["userId"],
                "lmsSubmissionId": sub.get("id"),
            })
        return {"imported": imported, "skipped": skipped}

    @app.post("/classroom/courses/{course_id}/coursework/{work_id}/sync", response_model=ApiLmsSyncResult)
    def classroom_sync(course_id: str, work_id: str, user: User, body: Optional[LmsSyncRequest] = None):
        """Push graded BirdBrains scores back to Google Classroom as draft grades."""
        sess = classroom_session(user)
        return _sync_lms_grades(user, "google_classroom", course_id, work_id, body,
                                lambda rec, score, max_score, _fb: sess.sync_grade(
                                    course_id, work_id, rec["lmsSubmissionId"],
                                    (score / max_score * 100.0) if max_score > 0 else 0.0,
                                ))

    # ---------------------------------------- Multi-LMS (Brightspace, Canvas, Microsoft Edu)
    def lms_provider(provider_id: str) -> LmsProvider:
        if provider_id not in LMS_PROVIDERS:
            raise HTTPException(404, f"Unknown LMS provider: {provider_id}")
        prov = d.lms_providers.get(provider_id)
        if not prov:
            raise HTTPException(503, f"LMS_NOT_CONFIGURED:{provider_id}")
        return prov

    def lms_teacher(user: dict, provider_id: str) -> LmsProvider:
        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts can connect an LMS")
        if account_plan(user) != "pro":
            raise HTTPException(402, "PRO_ONLY")
        return lms_provider(provider_id)

    def lms_token_key(uid: str, provider_id: str) -> str:
        return f"{uid}:{provider_id}"

    def lms_session(user: dict, provider_id: str):
        prov = lms_teacher(user, provider_id)
        tokens = d.store.get("lmstokens", lms_token_key(user["uid"], provider_id))
        if not tokens:
            raise HTTPException(409, f"LMS_NOT_CONNECTED:{provider_id}")
        try:
            return prov.open(tokens["tokenData"])
        except LmsError:
            d.store.delete("lmstokens", lms_token_key(user["uid"], provider_id))
            raise HTTPException(409, f"LMS_NOT_CONNECTED:{provider_id}")

    def disconnect_lms(user: dict, provider_id: str) -> None:
        key = lms_token_key(user["uid"], provider_id)
        tokens = d.store.get("lmstokens", key)
        if tokens:
            prov = d.lms_providers.get(provider_id)
            if prov:
                try:
                    prov.revoke(tokens["tokenData"])
                except Exception:
                    pass
            d.store.delete("lmstokens", key)

    def lms_call(call):
        try:
            return call()
        except LmsError as e:
            log.warning("LMS call failed: %s", e)
            raise HTTPException(502, f"LMS could not be reached: {e}")

    def _sync_lms_grades(user: dict, provider_id: str, course_id: str, work_id: str,
                         body: Optional[LmsSyncRequest], push_fn) -> dict:
        records = [
            r for r in d.store.query("lmsimports", "teacherUid", user["uid"])
            if r.get("provider") == provider_id and r.get("courseId") == course_id and r.get("assignmentId") == work_id
        ]
        if body and body.submissionIds:
            wanted = set(body.submissionIds)
            records = [r for r in records if r["submissionId"] in wanted]
        synced, skipped = [], []
        for rec in records:
            sub = d.store.get("submissions", rec["submissionId"])
            if not sub or sub.get("status") != "GRADED" or not sub.get("gradingId"):
                skipped.append({"studentName": rec["studentName"], "reason": "Not graded in BirdBrains yet"})
                continue
            grading = d.store.get("gradings", sub["gradingId"])
            if not grading:
                skipped.append({"studentName": rec["studentName"], "reason": "Grading record missing"})
                continue
            score = float(grading.get("totalScoreEarned", 0.0))
            max_score = float(grading.get("totalScorePossible", 0.0))
            feedback = grading.get("studentFacingSummary") or "Graded by BirdBrains"
            try:
                push_fn(rec, score, max_score, feedback)
                synced.append({
                    "submissionId": rec["submissionId"],
                    "studentName": rec["studentName"],
                    "score": score,
                    "maxScore": max_score,
                })
            except (ClassroomError, LmsError) as e:
                skipped.append({"studentName": rec["studentName"], "reason": str(e)})
        return {"synced": synced, "skipped": skipped}

    @app.get("/lms/providers", response_model=list[ApiLmsProviderStatus])
    def lms_providers_status(user: User):
        plan = account_plan(user)
        out = [
            ApiLmsProviderStatus(
                id="google_classroom",
                name="Google Classroom",
                configured=d.classroom is not None,
                connected=d.store.get("googletokens", user["uid"]) is not None,
                requiresInstanceUrl=False,
                plan=plan,
            )
        ]
        for pid, meta in LMS_PROVIDERS.items():
            tok = d.store.get("lmstokens", lms_token_key(user["uid"], pid))
            out.append(
                ApiLmsProviderStatus(
                    id=pid,
                    name=meta["name"],
                    configured=pid in d.lms_providers,
                    connected=tok is not None,
                    requiresInstanceUrl=meta["requiresInstanceUrl"],
                    defaultPlaceholder=meta["defaultPlaceholder"],
                    instanceUrl=(tok or {}).get("instanceUrl"),
                    plan=plan,
                )
            )
        return out

    @app.post("/lms/{provider_id}/connect")
    def lms_connect(provider_id: str, user: User, body: Optional[LmsConnectRequest] = None):
        prov = lms_teacher(user, provider_id)
        instance_url = body.instanceUrl if body else None
        if prov.requires_instance_url:
            try:
                instance_url = normalize_instance_url(instance_url)
            except LmsError as e:
                raise HTTPException(422, str(e))
        state = secrets.token_urlsafe(32)
        d.store.put("oauthstates", state, {
            "uid": user["uid"],
            "provider": provider_id,
            "instanceUrl": instance_url,
            "kind": "lms",
            "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        })
        return {"url": prov.auth_url(state, instance_url=instance_url, sso=False)}

    @app.get("/lms/{provider_id}/callback")
    def lms_callback(provider_id: str, state: str = "", code: str = "", error: str = ""):
        back = f"{d.site_url}/teacher?lms={urllib.parse.quote(provider_id)}&status="
        pending = d.store.get("oauthstates", state) if state else None
        if state:
            d.store.delete("oauthstates", state)
        prov = d.lms_providers.get(provider_id)
        if (
            not pending
            or pending.get("provider") != provider_id
            or not prov
            or not code
            or error
            or datetime.fromisoformat(pending["expiresAt"]) < datetime.now(timezone.utc)
        ):
            return RedirectResponse(back + "failed", status_code=303)
        try:
            token_data = prov.exchange(code, instance_url=pending.get("instanceUrl"), sso=False)
        except LmsError:
            return RedirectResponse(back + "failed", status_code=303)
        d.store.put("lmstokens", lms_token_key(pending["uid"], provider_id), {
            "uid": pending["uid"],
            "provider": provider_id,
            "instanceUrl": pending.get("instanceUrl"),
            "tokenData": token_data,
            "connectedAt": now_iso(),
        })
        return RedirectResponse(back + "connected", status_code=303)

    @app.delete("/lms/{provider_id}", status_code=204)
    def lms_disconnect(provider_id: str, user: User):
        if provider_id not in LMS_PROVIDERS:
            raise HTTPException(404, f"Unknown LMS provider: {provider_id}")
        disconnect_lms(user, provider_id)
        return Response(status_code=204)

    @app.get("/lms/{provider_id}/courses")
    def lms_courses(provider_id: str, user: User):
        sess = lms_session(user, provider_id)
        return lms_call(sess.courses)

    @app.get("/lms/{provider_id}/courses/{course_id}/assignments")
    def lms_assignments(provider_id: str, course_id: str, user: User):
        sess = lms_session(user, provider_id)
        return lms_call(lambda: sess.assignments(course_id))

    @app.post("/lms/{provider_id}/courses/{course_id}/assignments/{work_id}/import", response_model=ApiClassroomImport)
    def lms_import(provider_id: str, course_id: str, work_id: str, body: ClassroomImportRequest, user: User):
        sess = lms_session(user, provider_id)
        names = lms_call(lambda: sess.student_names(course_id))
        handed_in = lms_call(lambda: sess.submissions(course_id, work_id))
        imported, skipped = [], []
        for sub in handed_in:
            name = names.get(sub["userId"], "Student")
            if sub.get("state") not in ("TURNED_IN", "RETURNED"):
                skipped.append({"studentName": name, "reason": "Not handed in yet"})
                continue
            blobs = []
            for f in sub["files"][:MAX_FILES]:
                try:
                    blobs.append(sess.download(f["id"], f.get("url"))[0])
                except LmsError:
                    pass
            if not blobs:
                skipped.append({"studentName": name, "reason": "No photo attached (JPEG, PNG or WebP)"})
                continue
            key = f"{user['uid']}:{provider_id}:{sub['userId']}"
            roster = next(iter(d.store.query("rosters", "lmsKey", key)), None)
            if not roster:
                roster = {
                    "studentId": new_id("stu"),
                    "teacherUid": user["uid"],
                    "lmsKey": key,
                    "lmsProvider": provider_id,
                    "lmsCourseId": course_id,
                    "tenantId": tenant_of(user),
                    "createdAt": now_iso(),
                }
            roster.update(name=name, course=body.course.value)
            d.store.put("rosters", roster["studentId"], roster)
            try:
                payload = ingest(
                    user["uid"], tenant_of(user), roster["studentId"], body.course,
                    body.unitTopic, None, blobs, provider_id,
                )
            except HTTPException as e:
                reason = "Already imported" if e.status_code == 409 else str(e.detail)
                skipped.append({"studentName": name, "reason": reason})
                continue
            imported.append({"studentId": roster["studentId"], "studentName": name, "submissionId": payload.submissionId})
            d.store.put("lmsimports", payload.submissionId, {
                "submissionId": payload.submissionId,
                "teacherUid": user["uid"],
                "studentId": roster["studentId"],
                "studentName": name,
                "provider": provider_id,
                "courseId": course_id,
                "assignmentId": work_id,
                "lmsUserId": sub["userId"],
                "lmsSubmissionId": sub.get("id"),
            })
        return {"imported": imported, "skipped": skipped}

    @app.post("/lms/{provider_id}/courses/{course_id}/assignments/{work_id}/sync", response_model=ApiLmsSyncResult)
    def lms_sync(provider_id: str, course_id: str, work_id: str, user: User, body: Optional[LmsSyncRequest] = None):
        sess = lms_session(user, provider_id)
        return _sync_lms_grades(
            user, provider_id, course_id, work_id, body,
            lambda rec, score, max_score, fb: sess.sync_grade(
                course_id, work_id, rec["lmsUserId"], rec.get("lmsSubmissionId"), score, max_score, fb
            ),
        )

    # ---------------------------------------- School LMS SSO (Brightspace, Canvas, Microsoft)
    @app.post("/auth/lms/{provider_id}/connect")
    def lms_sso_connect(provider_id: str, body: Optional[LmsConnectRequest] = None):
        prov = lms_provider(provider_id)
        instance_url = body.instanceUrl if body else None
        if prov.requires_instance_url:
            try:
                instance_url = normalize_instance_url(instance_url)
            except LmsError as e:
                raise HTTPException(422, str(e))
        state = secrets.token_urlsafe(32)
        d.store.put("oauthstates", state, {
            "provider": provider_id,
            "instanceUrl": instance_url,
            "kind": "sso",
            "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        })
        return {"url": prov.auth_url(state, instance_url=instance_url, sso=True)}

    @app.get("/auth/lms/{provider_id}/callback")
    def lms_sso_callback(provider_id: str, state: str = "", code: str = "", error: str = ""):
        back_err = f"{d.site_url}/?ssoError={urllib.parse.quote(provider_id)}"
        pending = d.store.get("oauthstates", state) if state else None
        if state:
            d.store.delete("oauthstates", state)
        prov = d.lms_providers.get(provider_id)
        if (
            not pending
            or pending.get("kind") != "sso"
            or pending.get("provider") != provider_id
            or not prov
            or not code
            or error
            or datetime.fromisoformat(pending["expiresAt"]) < datetime.now(timezone.utc)
        ):
            return RedirectResponse(back_err, status_code=303)
        try:
            tok = prov.exchange(code, instance_url=pending.get("instanceUrl"), sso=True)
            info = prov.user_info(tok["access_token"], instance_url=pending.get("instanceUrl"))
        except LmsError:
            return RedirectResponse(back_err, status_code=303)
        raw_uid = f"lms_{provider_id}_{info['sub']}"
        custom_token = d.auth.create_custom_token(raw_uid, {"provider": provider_id, "name": info.get("name", "")})
        q = urllib.parse.urlencode({"ssoToken": custom_token, "ssoName": info.get("name", ""), "provider": provider_id})
        return RedirectResponse(f"{d.site_url}/?{q}", status_code=303)

    @app.get("/teacher/students", response_model=list[ApiRosterStudent])
    def teacher_students(user: User):
        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts have a class list")
        return sorted(d.store.query("rosters", "teacherUid", user["uid"]), key=lambda r: r["name"])

    @app.post("/teacher/students", response_model=list[ApiRosterStudent])
    def add_roster_student(body: AddRosterStudentRequest, user: User):
        """A teacher adds a student who has their own account, with the link code
        the student sees on their home page. No LMS needed."""
        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts have a class list")
        link = d.store.get("linkcodes", body.linkCode.strip().upper())
        found = link and d.store.query("users", "studentId", link["studentId"])
        if not found:
            raise HTTPException(404, "That link code was not recognised")
        sid = link["studentId"]
        roster = d.store.get("rosters", sid)
        if roster and roster.get("teacherUid") != user["uid"]:
            raise HTTPException(409, "That student is already on another teacher's class list")
        student = found[0]
        d.store.put("rosters", sid, {"studentId": sid, "teacherUid": user["uid"], "name": student["name"],
                                     "course": student.get("course") or "MPM2D", "linkedAccount": True,
                                     "tenantId": tenant_of(user)})
        return teacher_students(user)

    @app.delete("/teacher/students/{student_id}", response_model=list[ApiRosterStudent])
    def remove_roster_student(student_id: str, user: User):
        """Take a student added by link code off the list. Their account and work stay."""
        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts have a class list")
        roster = d.store.get("rosters", student_id)
        if not roster or roster.get("teacherUid") != user["uid"]:
            raise HTTPException(404, "Not found")
        if not roster.get("linkedAccount"):
            raise HTTPException(409, "Students imported from a class list are removed in that LMS")
        d.store.delete("rosters", student_id)
        return teacher_students(user)

    # ------------------------------------------------------------------ reports
    def build_progress(student_id: str):
        from .reports import progress_report

        stored = d.store.get("ledgers", student_id)
        return progress_report(student_profile(student_id), effective_plan(student_id),
                               StudentLedger.model_validate(stored) if stored else None,
                               d.store.query("gradings", "studentId", student_id))

    @app.get("/students/{student_id}/progress", response_model=ApiProgressReport)
    def student_progress(student_id: str, user: User):
        """Results over time: mastery per strand, every graded upload, and which
        error codes keep coming back."""
        require_student_access(user, student_id)
        return build_progress(student_id)

    @app.get("/teacher/report", response_model=ApiCohortReport)
    def teacher_report(user: User, googleCourseId: Optional[str] = None):
        """The teacher's class at a glance (Pro). Optionally one Classroom course."""
        from .reports import cohort_report

        if user["role"] != "teacher":
            raise HTTPException(403, "Only teacher accounts have a class report")
        if account_plan(user) != "pro":
            raise HTTPException(402, "PRO_ONLY")
        roster = [r for r in d.store.query("rosters", "teacherUid", user["uid"])
                  if googleCourseId is None or r.get("googleCourseId") == googleCourseId]
        return cohort_report([build_progress(r["studentId"]) for r in roster], googleCourseId)

    # ------------------------------------------------- nightly batch (internal)
    def require_batch_token(x_batch_token: Annotated[Optional[str], Header()] = None) -> None:
        if not d.batch_token:
            raise HTTPException(503, "Batch routes are disabled: BIRDBRAINS_BATCH_TOKEN is not set")
        if not x_batch_token or not hmac.compare_digest(x_batch_token, d.batch_token):
            raise HTTPException(401, "Invalid batch token")

    @app.post("/internal/batch/worksheets/submit", dependencies=[Depends(require_batch_token)])
    def batch_submit():
        queued = d.store.query("gradings", "worksheetStatus", "QUEUED")
        items = [
            FlaggedGrading(
                grading_id=g["gradingId"],
                course=CourseEnum(g["course"]),
                unit_topic=g["unitTopic"],
                scaffolding_mode=ScaffoldingModeEnum(g["scaffoldingMode"]),
                stage2=Stage2GradingAndAffectOutput.model_validate(g["stage2"]),
            )
            for g in queued
        ]
        job = d.batch.submit(items)
        if not job:
            return {"submitted": 0}
        d.store.put("batchjobs", job["name"].replace("/", "_"), job)
        for g in queued:
            g.update(worksheetStatus="PENDING", worksheetAttempts=g.get("worksheetAttempts", 0) + 1)
            d.store.put("gradings", g["gradingId"], g)
        return {"submitted": len(items), "job": job["name"]}

    @app.post("/internal/batch/worksheets/collect", dependencies=[Depends(require_batch_token)])
    def batch_collect():
        ready = failed = running = 0
        errors = 0
        for job in d.store.query("batchjobs", "state", "SUBMITTED"):
            try:
                result = d.batch.collect(job)
            except Exception:
                # One job Vertex can't report on must not hold up the others; it is
                # asked again at the next collect.
                log.exception("Collecting batch job %s failed", job.get("name"))
                errors += 1
                continue
            if result is None:
                running += 1
                continue
            done, bad = result
            for grading_id, content in done.items():
                g = d.store.get("gradings", grading_id)
                if not g or grading_id not in job["gradingIds"] or g.get("worksheetStatus") == "READY":
                    continue  # gone, not ours, or already made on demand
                d.store.put("worksheets", grading_id, {
                    "worksheetId": new_id("wks"), "gradingId": grading_id, "studentId": g["studentId"],
                    "createdAt": now_iso(), "content": content.model_dump(mode="json"),
                    "tenantId": tenant_of(g),
                })
                g["worksheetStatus"] = "READY"
                d.store.put("gradings", grading_id, g)
                ready += 1
            for grading_id in bad:
                g = d.store.get("gradings", grading_id)
                if not g or g.get("worksheetStatus") == "READY":
                    continue
                retry = g.get("worksheetAttempts", 0) < MAX_WORKSHEET_ATTEMPTS
                g["worksheetStatus"] = "QUEUED" if retry else "FAILED"
                d.store.put("gradings", grading_id, g)
                failed += 1
            job["state"] = "COLLECTED"
            d.store.put("batchjobs", job["name"].replace("/", "_"), job)
        return {"ready": ready, "failed": failed, "jobsStillRunning": running, "jobsWithErrors": errors}

    # --------------------------- schools and classes (internal; no teacher accounts at launch)
    @app.post("/internal/schools", status_code=201, dependencies=[Depends(require_batch_token)])
    def create_school(body: CreateSchoolRequest):
        tenant_id = body.tenantId
        if tenant_id is None:
            tenant_id = "ten_" + "".join(secrets.choice(_ALNUM) for _ in range(10))
            d.store.put("tenants", tenant_id, {"tenantId": tenant_id, "createdAt": now_iso(),
                                               "organizationName": body.organizationName or body.schoolName})
        elif not d.store.get("tenants", tenant_id):
            raise HTTPException(404, "Unknown tenant")
        school = {"schoolId": new_id("sch"), "tenantId": tenant_id, "schoolName": body.schoolName.strip(),
                  "districtCode": body.districtCode, "createdAt": now_iso()}
        d.store.put("schools", school["schoolId"], school)
        return school

    @app.post("/internal/schools/{school_id}/classes", status_code=201, dependencies=[Depends(require_batch_token)])
    def create_class(school_id: str, body: CreateClassRequest):
        school = d.store.get("schools", school_id)
        if not school:
            raise HTTPException(404, "Unknown school")
        code = "".join(secrets.choice(_CODE_CHARS) for _ in range(6))
        cls = {"classId": new_id("cls"), "schoolId": school_id, "tenantId": school["tenantId"],
               "className": body.className.strip(), "gradeLevel": body.gradeLevel, "joinCode": code,
               "createdAt": now_iso()}
        d.store.put("classes", cls["classId"], cls)
        d.store.put("joincodes", code, {"classId": cls["classId"]})
        return cls

    @app.post("/internal/users/{uid}/plan", response_model=UserProfile, dependencies=[Depends(require_batch_token)])
    def set_plan(uid: str, body: SetPlanRequest):
        """Admin only until billing exists. A parent on Pro covers every linked child."""
        profile = d.store.get("users", uid)
        if not profile:
            raise HTTPException(404, "Unknown user")
        profile["plan"] = body.plan
        d.store.put("users", uid, profile)
        return profile

    @app.post("/internal/testers", response_model=UserProfile, dependencies=[Depends(require_batch_token)])
    def set_tester(body: SetTesterRequest):
        """Turn a testing account on or off, by sign-in email or uid. Admin only:
        the batch token is a server secret, so no one can grant this to themselves."""
        uid = body.uid or d.auth.uid_for_email(body.email)
        profile = d.store.get("users", uid) if uid else None
        if not profile:
            raise HTTPException(404, "No BirdBrains account for that email or uid. Sign up on the site first.")
        if body.tester:
            profile["tester"] = True
        else:
            profile.pop("tester", None)
        d.store.put("users", uid, profile)
        return profile

    @app.get("/internal/stats", dependencies=[Depends(require_batch_token)])
    def stats(days: int = 1):
        """Numbers for the daily pilot summary. Counts and codes only: no names, no ids."""
        from collections import Counter

        days = max(1, min(days, 31))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        subs = d.store.query_since("submissions", "uploadedAt", since)
        grads = d.store.query_since("gradings", "gradedAt", since)
        # Uploads from testing accounts are counted apart so they do not skew the pilot numbers.
        testers = {sid for sid in {s["studentId"] for s in subs} | {g["studentId"] for g in grads} if is_tester(sid)}
        tester_uploads = sum(1 for s in subs if s["studentId"] in testers)
        subs = [s for s in subs if s["studentId"] not in testers]
        grads = [g for g in grads if g["studentId"] not in testers]
        codes: Counter = Counter()
        cost: Counter = Counter()
        seconds: list[float] = []
        clean = 0
        for g in grads:
            roots = [e["error_code"] for e in g["stage2"]["identified_errors"] if not e["is_cascading_consequence"]]
            codes.update(roots)
            clean += not roots
            cost[g.get("plan", "free")] += (g.get("cost") or {}).get("usd", 0.0)
            if g.get("cost"):
                seconds.append(g["cost"]["seconds"])
        students = {s["studentId"] for s in subs}
        plans = {sid: effective_plan(sid) for sid in students}
        seconds.sort()
        return {
            "days": days, "since": since,
            "newAccounts": dict(Counter(u["role"] for u in d.store.query_since("users", "createdAt", since))),
            "uploads": len(subs),
            "testerUploads": tester_uploads,
            "uploadsByStatus": dict(Counter(s["status"] for s in subs)),
            "uploadsBySource": dict(Counter(s.get("source", "web") for s in subs)),
            "activeStudents": len(students),
            "activeStudentsByPlan": dict(Counter(plans.values())),
            "freeStudentsAtCap": sum(1 for sid, p in plans.items() if p == "free" and usage(sid).remaining == 0),
            "graded": len(grads),
            "gradedByPlan": dict(Counter(g.get("plan", "free") for g in grads)),
            "gradedWithNoErrors": clean,
            "topErrorCodes": [{"code": c, "count": n} for c, n in codes.most_common(8)],
            "modelCostUsdByPlan": {k: round(v, 4) for k, v in cost.items()},
            "modelSecondsMedian": seconds[len(seconds) // 2] if seconds else None,
            "modelSecondsP95": seconds[max(-(-95 * len(seconds) // 100) - 1, 0)] if seconds else None,
            "worksheets": dict(Counter(g["worksheetStatus"] for g in grads)),
        }

    return app


def __getattr__(name: str):
    # ``uvicorn birdbrains.api:app`` builds the app lazily so that importing this
    # module (e.g. in tests) does not need cloud credentials.
    if name == "app":
        return create_app()
    raise AttributeError(name)
