"""HTTP API (FastAPI). Run locally with ``uvicorn birdbrains.api:app``."""

import hashlib
import hmac
import io
import logging
import os
import secrets
import string
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from . import mastery_affect_ledger as ledger_engine
from .auth import Authenticator
from .batch_engine import BatchEngine, FlaggedGrading, is_flagged
from .privacy import CloudDlp, PhotoScrubber
from .pipeline import ImageRef, PipelineEngine, SubmissionContext, configure_tracing
from .projections import parent_summary, to_api_grading, to_api_worksheet
from .schemas import (
    STUDENT_ID_PATTERN,
    ApiGrading,
    ApiClass,
    ApiParentSummary,
    ApiWorksheet,
    CreateClassRequest,
    CreateSchoolRequest,
    JoinClassRequest,
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
)
from .storage import BlobStorage
from .store import Store
from .taxonomy import strand_for

log = logging.getLogger(__name__)

MIN_SHORT_EDGE = 1080  # matches lib/imageQuality.ts
MIN_SHARPNESS_SCORE = 59  # the client's "Too Blurry" cut-off (variance 60) on its 0-100 scale
MAX_FILES = 6
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_WORKSHEET_ATTEMPTS = 2
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
    cors_origins: tuple[str, ...] = ("https://birdbrains.netlify.app", "http://localhost:3000")
    inline_images: bool = False  # local mode: send image bytes to the model, there is no gs:// URI
    scrubber: PhotoScrubber = field(default_factory=PhotoScrubber)


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

    header = float(os.environ.get("BIRDBRAINS_HEADER_MASK", "0.12"))
    scrubber = PhotoScrubber(CloudDlp(project) if backend == "gcp" else None, header_fraction=header)

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
    )


def create_app(deps: Optional[Deps] = None) -> FastAPI:
    d = deps or deps_from_env()
    configure_tracing()
    app = FastAPI(title="BirdBrains API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(d.cors_origins),
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
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

    @app.get("/me", response_model=UserProfile)
    def me(user: User):
        return user

    @app.post("/me", response_model=UserProfile)
    def register(body: RegisterRequest, uid: Annotated[str, Depends(current_uid)]):
        existing = d.store.get("users", uid)
        if existing:
            return existing  # role is fixed once chosen
        profile = {"uid": uid, "role": body.role, "name": body.name.strip(), "childStudentIds": [],
                   "tenantId": CONSUMER_TENANT, "classIds": []}
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
        return user

    def student_profile(student_id: str) -> dict:
        found = d.store.query("users", "studentId", student_id)
        if not found:
            raise HTTPException(404, "Not found")
        return found[0]

    @app.patch("/me", response_model=UserProfile)
    def update_profile(body: UpdateProfileRequest, user: User):
        user["name"] = body.name.strip()
        d.store.put("users", user["uid"], user)
        return user

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
            d.store.delete("users", user["uid"])
            d.auth.delete_user(user["uid"])
        return Response(status_code=204)

    # -------------------------------------------------------------- submissions
    @app.post("/submissions", response_model=SubmissionIngestionPayload, status_code=201)
    def create_submission(
        user: User,
        studentId: Annotated[str, Form(pattern=STUDENT_ID_PATTERN)],
        course: Annotated[CourseEnum, Form()],
        unitTopic: Annotated[str, Form(min_length=1, max_length=200)],
        sharpnessScore: Annotated[float, Form(ge=0, le=100)],
        files: Annotated[list[UploadFile], File()],
    ):
        require_student_access(user, studentId)
        if not 1 <= len(files) <= MAX_FILES:
            raise HTTPException(422, f"Attach between 1 and {MAX_FILES} photos")
        submission_id = new_id("sub")
        stored, smallest = [], None
        for i, upload in enumerate(files):
            data = upload.file.read(MAX_FILE_BYTES + 1)
            if len(data) > MAX_FILE_BYTES:
                raise HTTPException(413, "Each photo must be 12 MB or smaller")
            try:
                with Image.open(io.BytesIO(data)) as img:
                    fmt, (w, h) = img.format, img.size
                    img.verify()
            except Exception:
                raise HTTPException(422, "One of the files is not a readable image")
            if fmt not in ALLOWED_TYPES:
                raise HTTPException(422, "Photos must be JPEG, PNG or WebP")
            if min(w, h) < MIN_SHORT_EDGE:
                raise HTTPException(422, f"Photo {i + 1} is below 1080p ({w}x{h}). Please retake it.")
            if smallest is None or min(w, h) < min(smallest):
                smallest = (w, h)
            stored.append((i, data, ALLOWED_TYPES[fmt], fmt.lower(), hashlib.sha256(data).hexdigest()))
        if sharpnessScore < MIN_SHARPNESS_SCORE:
            raise HTTPException(422, "The photo is too blurry. Please retake it.")
        # UT-06: the exact same photo uploaded again for this student is a 409, and
        # the pipeline is not run a second time. Location points at the original.
        for i, *_, sha in stored:
            seen = d.store.get("imagehashes", f"{studentId}_{sha}")
            if seen:
                raise HTTPException(
                    409, f"Photo {i + 1} was already uploaded. Open your earlier diagnostic instead.",
                    headers={"Location": f"/submissions/{seen['submissionId']}"})

        file_records = []
        for i, data, mime, ext, sha in stored:
            try:
                data = d.scrubber.scrub(data, ext.upper())  # names and EXIF removed before storage
            except Exception:
                log.exception("Photo scrubbing failed")
                raise HTTPException(503, "We could not check the photo for names. Please try again.")
            path = f"submissions/{studentId}/{submission_id}/{i}.{ext}"
            uri = d.storage.write_bytes(path, data, mime)
            file_records.append({"path": path, "uri": uri, "mimeType": mime, "sha256": sha})
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
            "uploadedBy": user["uid"],
            "tenantId": tenant_of(user),
        }
        d.store.put("submissions", submission_id, record)
        for *_, sha in stored:
            d.store.put("imagehashes", f"{studentId}_{sha}", {"studentId": studentId, "submissionId": submission_id})
        return submission_payload(record)

    def submission_payload(record: dict) -> SubmissionIngestionPayload:
        urls = [f"/submissions/{record['submissionId']}/files/{i}" for i in range(len(record["files"]))]
        return SubmissionIngestionPayload(**{k: v for k, v in record.items() if k not in ("files", "uploadedBy", "tenantId")},
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
            raise HTTPException(410, "PHOTO_EXPIRED")  # raw photos are deleted after 90 days
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

        def set_status(status: str, **extra):
            record.update(status=status, **extra)
            d.store.put("submissions", submission_id, record)

        ctx = SubmissionContext(submission_id, CourseEnum(record["course"]), record["unitTopic"])
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
                stage1 = d.pipeline.run_stage1(ctx, images)
                d.store.put("transcriptions", submission_id, stage1.model_dump(mode="json"))
            if stage1.requires_hitl:
                set_status("NEEDS_RETAKE")
                return {"submission": submission_payload(record), "grading": None}

            set_status("GRADING")
            stage2 = d.pipeline.run_stage2(ctx, stage1)
        except HTTPException:
            raise
        except Exception:
            log.exception("Pipeline failed for %s", submission_id)
            set_status("FAILED")
            raise HTTPException(502, "The diagnostic could not be completed. Please try again.")

        student_id = record["studentId"]
        strand = strand_for(ctx.course, ctx.unit_topic)
        stored_ledger = d.store.get("ledgers", student_id)
        ledger = StudentLedger.model_validate(stored_ledger) if stored_ledger else StudentLedger(student_id=student_id)
        ledger = ledger_engine.apply_observation(ledger, stage2, strand)
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
            "scaffoldingMode": ledger.scaffolding_mode.value,
            "stage2": stage2.model_dump(mode="json"),
            "worksheetStatus": "QUEUED" if is_flagged(stage2) else "NOT_NEEDED",
            "worksheetAttempts": 0,
            "tenantId": tenant_of(record),
        }
        d.store.put("gradings", grading_id, grading)
        set_status("GRADED", gradingId=grading_id)
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

    # -------------------------------------------------------- parent dashboard
    @app.get("/students/{student_id}/parent-summary", response_model=ApiParentSummary)
    def get_parent_summary(student_id: str, user: User):
        require_student_access(user, student_id)
        stored = d.store.get("ledgers", student_id)
        ledger = StudentLedger.model_validate(stored) if stored else StudentLedger(student_id=student_id)
        summary = parent_summary(student_profile(student_id), ledger, student_gradings(student_id))
        if summary is None:
            raise HTTPException(404, "NO_GRADED_WORK")
        return summary

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
        for job in d.store.query("batchjobs", "state", "SUBMITTED"):
            result = d.batch.collect(job)
            if result is None:
                running += 1
                continue
            done, bad = result
            for grading_id, content in done.items():
                g = d.store.get("gradings", grading_id)
                if not g or grading_id not in job["gradingIds"]:
                    continue
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
                if not g:
                    continue
                retry = g.get("worksheetAttempts", 0) < MAX_WORKSHEET_ATTEMPTS
                g["worksheetStatus"] = "QUEUED" if retry else "FAILED"
                d.store.put("gradings", grading_id, g)
                failed += 1
            job["state"] = "COLLECTED"
            d.store.put("batchjobs", job["name"].replace("/", "_"), job)
        return {"ready": ready, "failed": failed, "jobsStillRunning": running}

    # --------------------------- schools and classes (internal until teachers, Nov 23)
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

    return app


def __getattr__(name: str):
    # ``uvicorn birdbrains.api:app`` builds the app lazily so that importing this
    # module (e.g. in tests) does not need cloud credentials.
    if name == "app":
        return create_app()
    raise AttributeError(name)
