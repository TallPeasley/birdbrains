"""Pydantic v2 data contracts.

Two families live here:

* Pipeline contracts (snake_case, ``extra="forbid"``): what Gemini must return and
  what the ledger and batch engine pass around. These follow the AI pipeline spec.
  Fields marked "extension" are not in the spec's reference schemas; they carry the
  data the dashboards need (scores, framing copy, severity) so that nothing shown to
  a family is invented outside the model's diagnostic pass.
* API contracts (camelCase): the JSON the Next.js frontend consumes. Shapes match
  ``types/birdBrains.ts``.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

STUDENT_ID_PATTERN = r"^stu_[a-zA-Z0-9]{12}$"
SUBMISSION_ID_PATTERN = r"^sub_[a-zA-Z0-9]{12}$"
GRADING_ID_PATTERN = r"^grd_[a-zA-Z0-9]{12}$"
WORKSHEET_ID_PATTERN = r"^wks_[a-zA-Z0-9]{12}$"
TENANT_ID_PATTERN = r"^ten_[a-zA-Z0-9]{10}$"
# The 24 six-pillar error codes (see taxonomy.ERROR_CODES). Ids of codes that moved
# pillar are retired; LEGACY_CODES maps them so gradings stored before 2026-11-25 load.
ERROR_CODE_PATTERN = r"^(CON-0[1456]|STR-0[1-4]|PRC-0[1-4]|FAC-0[1-4]|COM-0[1-4]|TST-0[3-6])$"
LEGACY_CODES = {"CON-02": "STR-01", "CON-03": "STR-02", "TST-01": "COM-01", "TST-02": "COM-02"}


def _upgrade_legacy_code(data):
    """Before validation: swap a retired code for its new id and file it under the new
    code's pillar. Leaves anything else alone."""
    if isinstance(data, dict):
        code = data.get("error_code")
        if code in LEGACY_CODES:
            data = {**data, "error_code": LEGACY_CODES[code]}
            if data.get("pillar") is not None:
                data["pillar"] = LEGACY_CODES[code][:3]
    return data


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- enums
class PillarEnum(str, Enum):
    CON = "CON"  # Concepts
    STR = "STR"  # Strategy & Setup
    PRC = "PRC"  # Procedure
    FAC = "FAC"  # Calculation & Recall
    COM = "COM"  # Communication
    TST = "TST"  # Test Habits


class AffectStateEnum(str, Enum):
    CONFIDENT_MASTERY = "CONFIDENT_MASTERY"
    PRODUCTIVE_STRUGGLE = "PRODUCTIVE_STRUGGLE"
    HIGH_FRICTION_FRUSTRATION = "HIGH_FRICTION_FRUSTRATION"
    COGNITIVE_OVERLOAD_AVOIDANCE = "COGNITIVE_OVERLOAD_AVOIDANCE"
    RUSHED_CARELESSNESS = "RUSHED_CARELESSNESS"


class VisualAffectMarker(str, Enum):
    CLEAN_CONTINUOUS_FLOW = "CLEAN_CONTINUOUS_FLOW"
    HEAVY_SCRATCHOUT_DENSITY = "HEAVY_SCRATCHOUT_DENSITY"
    REPEATED_REWRITES = "REPEATED_REWRITES"
    MARGIN_QUESTION_MARKS = "MARGIN_QUESTION_MARKS"
    MID_STEP_ABANDONMENT = "MID_STEP_ABANDONMENT"
    SPATIAL_COMPRESSION_RUSHING = "SPATIAL_COMPRESSION_RUSHING"


class ScaffoldingModeEnum(str, Enum):
    HIGH_SUPPORT_DEESCALATION = "HIGH_SUPPORT_DEESCALATION"
    METACOGNITIVE_SPEED_BUMP = "METACOGNITIVE_SPEED_BUMP"
    STANDARD_PROGRESSIVE_FADE = "STANDARD_PROGRESSIVE_FADE"


class SeverityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class CourseEnum(str, Enum):
    MTH1W = "MTH1W"
    MPM2D = "MPM2D"


class EQAOLevel(str, Enum):
    LEVEL_1 = "LEVEL_1"
    LEVEL_2 = "LEVEL_2"
    LEVEL_3 = "LEVEL_3"
    LEVEL_4 = "LEVEL_4"


# ------------------------------------------------------------------ Stage 1 output
class Stage1LineTranscription(Strict):
    line_number: int = Field(..., ge=1)
    raw_latex: str
    bounding_box_normalized: List[float] = Field(..., min_length=4, max_length=4)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    visual_affect_markers: List[VisualAffectMarker]
    # Which printed question this line answers ("1", "2", "2b"). Empty when the page has one question.
    question_label: str = ""


class QuestionInfo(Strict):
    """One printed question on the page, so each question's steps can be shown under it."""

    label: str
    printed_text: str = ""  # the printed question, verbatim; empty if it can't be read


class Stage1QuestionTranscription(Strict):
    """One numbered (or standalone) question segmented on the worksheet."""

    question_number: str
    problem_statement: str = ""
    lines: List[Stage1LineTranscription] = Field(default_factory=list)


UnreadableReason = Literal["HANDWRITING_UNCLEAR", "BLANK_PAGE", "NOT_MATH", "QUESTIONS_NOT_VISIBLE",
                           "PAGE_CUT_OFF", "GLARE_OR_SHADOW"]


class Stage1VisionOutput(Strict):
    """Structured output requested from Gemini Stage 1 (vision & affect)."""

    submission_id: str
    overall_ocr_confidence: float = Field(..., ge=0.0, le=1.0)
    questions: List[Stage1QuestionTranscription]
    requires_hitl: bool = Field(default=False)
    # Only when requires_hitl is true: why the page cannot be graded.
    unreadable_reason: Optional[UnreadableReason] = None
    # What the page is about, read from the printed problems and the work. Students no
    # longer tag uploads; these fill the course, unit and topic. Empty when unsure.
    detected_course: Optional[Literal["MTH1W", "MPM2D"]] = None
    detected_unit: str = ""
    detected_topic: str = ""
    # The worksheet's printed code, such as "BB-W12", when one is printed on the page.
    detected_worksheet_code: str = ""


class Stage1TranscriptionOutput(Strict):
    submission_id: str
    overall_ocr_confidence: float = Field(..., ge=0.0, le=1.0)
    questions: List[Stage1QuestionTranscription] = Field(default_factory=list)
    # Legacy flat lines kept optional so previously stored transcriptions and
    # single-problem eval fixtures remain readable.
    lines: List[Stage1LineTranscription] = Field(default_factory=list)
    requires_hitl: bool = Field(default=False)
    unreadable_reason: Optional[UnreadableReason] = None
    detected_course: Optional[Literal["MTH1W", "MPM2D"]] = None
    detected_unit: str = ""
    detected_topic: str = ""
    # The worksheet's printed code, such as "BB-W12", when one is printed on the page.
    detected_worksheet_code: str = ""

    @model_validator(mode="before")
    @classmethod
    def _legacy_question_list(cls, data):
        """Transcriptions stored between the two question formats list questions as
        {label, printed_text} beside flat lines tagged with question_label. Rebuild
        them as segmented questions so old records still load."""
        if not isinstance(data, dict):
            return data
        qs = data.get("questions") or []
        if not qs or not all(isinstance(q, dict) and "label" in q for q in qs):
            return data
        lines = [l for l in (data.get("lines") or []) if isinstance(l, dict)]
        labels = [q["label"] for q in qs]
        grouped: dict[int, list] = {i: [] for i in range(len(qs))}
        current = 0
        for l in lines:
            if (l.get("question_label") or "") in labels:
                current = labels.index(l["question_label"])
            grouped[current].append(l)
        out = [
            {"question_number": q["label"] or str(i + 1), "problem_statement": q.get("printed_text", ""),
             "lines": [dict(l, line_number=n + 1) for n, l in enumerate(grouped[i])]}
            for i, q in enumerate(qs)
        ]
        # The flat lines stay too: older flat gradings point at them by page line number.
        return {**data, "questions": out}

    def resolved_questions(self) -> List[Stage1QuestionTranscription]:
        """Always return a per-question list, wrapping legacy flat lines as Q1."""
        if self.questions:
            return list(self.questions)
        if self.lines:
            return [Stage1QuestionTranscription(question_number="1", problem_statement="", lines=list(self.lines))]
        return []


# ------------------------------------------------------------------ Stage 2 output
KeyStepStatus = Literal["PRESENT", "PRESENT_WITH_ERROR", "MISSING", "EQUIVALENT_METHOD"]


class AnswerKeyStep(Strict):
    """One canonical step in the generated answer key for a question."""

    step_number: int = Field(..., ge=1)
    description: str
    expected_math: str
    is_key_step: bool = True


class QuestionAnswerKey(Strict):
    """Canonical answer key generated for a single question before evaluating steps."""

    method_used: str
    steps: List[AnswerKeyStep]
    final_answer: str
    answer_verification: str


class KeyStepCheck(Strict):
    """Checks whether an answer-key step shows up on the student's worksheet."""

    key_step_number: int = Field(..., ge=1)
    key_step_description: str
    expected_math: str
    status: KeyStepStatus
    matched_student_steps: List[int] = Field(default_factory=list)
    note: str


class FinalAnswerVerification(Strict):
    """Re-substitution / check of the student's final answer against the initial question."""

    student_final_answer: str
    resubstitution_check: str
    satisfies_initial_question: bool
    discrepancy_note: str = ""


class StepEvaluation(Strict):
    """One line of student work, judged. The spec leaves this as ``dict``; it is
    typed here so Gemini's structured output is constrained."""

    step_number: int = Field(..., ge=1)
    student_latex: str
    is_correct: bool
    # True when the line is wrong in absolute terms only because it faithfully
    # carries an earlier error forward. Such lines are not penalised.
    is_carry_forward_consistent: bool
    pillar: Optional[PillarEnum] = None
    error_code: Optional[str] = Field(default=None, pattern=ERROR_CODE_PATTERN)
    explanation: str
    # The question this line belongs to (copied from the transcription). Steps are judged
    # and numbered within their own question; carry-forward never crosses questions.
    question_label: str = ""

    _legacy = model_validator(mode="before")(_upgrade_legacy_code)


class SentimentEntityExtraction(Strict):
    entity_name: str
    valence_score: float = Field(..., ge=-1.0, le=1.0)
    friction_intensity: float = Field(..., ge=0.0, le=1.0)
    affect_state: AffectStateEnum


class RootCauseErrorItem(Strict):
    pillar: PillarEnum
    error_code: str = Field(..., pattern=ERROR_CODE_PATTERN)
    description: str
    target_entity: str
    is_cascading_consequence: bool
    severity: SeverityEnum = SeverityEnum.MEDIUM  # extension

    _legacy = model_validator(mode="before")(_upgrade_legacy_code)


class PillarScore(Strict):  # extension
    pillar: PillarEnum
    max_score: float = Field(..., ge=0.0)
    earned_score: float = Field(..., ge=0.0)
    feedback: str


class QuestionGradingOutput(Strict):
    """Isolated diagnostic analysis for a single question on the worksheet.

    Field order is intentional: the model generates ``answer_key``, checks the
    student's conclusion via ``final_answer_verification`` (re-substituting into
    the initial question), and verifies worksheet coverage via ``key_step_checks``
    BEFORE judging ``step_evaluations`` and ``identified_errors``.
    """

    question_number: str
    problem_statement: str
    answer_key: QuestionAnswerKey
    final_answer_verification: FinalAnswerVerification
    key_step_checks: List[KeyStepCheck]
    step_evaluations: List[StepEvaluation]
    identified_errors: List[RootCauseErrorItem]
    pillar_scores: List[PillarScore]
    sentiment_entities: List[SentimentEntityExtraction]
    aggregate_valence: float = Field(..., ge=-1.0, le=1.0)
    aggregate_friction: float = Field(..., ge=0.0, le=1.0)
    recommended_scaffolding_mode: ScaffoldingModeEnum
    supportive_framing_message: str
    parent_insight: str


class Stage2GradingAndAffectOutput(Strict):
    submission_id: str
    # Separate per-question analyses, each with its own answer key, key-step
    # coverage check, re-substitution check, steps, and errors.
    question_analyses: List[QuestionGradingOutput] = Field(default_factory=list)
    # Populated only for single-question or legacy gradings; left empty on
    # multi-question worksheets so steps from different questions are never merged.
    step_evaluations: List[StepEvaluation] = Field(default_factory=list)
    identified_errors: List[RootCauseErrorItem]
    sentiment_entities: List[SentimentEntityExtraction]
    aggregate_valence: float = Field(..., ge=-1.0, le=1.0)
    aggregate_friction: float = Field(..., ge=0.0, le=1.0)
    recommended_scaffolding_mode: ScaffoldingModeEnum
    # extensions
    pillar_scores: List[PillarScore] = Field(default_factory=list)
    supportive_framing_message: str = ""
    parent_insight: str = ""
    # Flat (older) gradings only: filled by questions.split_by_question, not by the model.
    # Gradings made question by question carry their questions in question_analyses.
    questions: List[QuestionInfo] = Field(default_factory=list)


# ------------------------------------------------------- worksheet (batch output)
class DiagnosticMirrorItem(Strict):
    # The student's last correct line, just before the mistake, so the worksheet can show
    # the move that went wrong (two lines), not only the wrong line. Empty on older worksheets.
    previous_step_text: str = ""
    original_step_text: str
    # The exact piece of original_step_text that is wrong (e.g. "- 9") and what it should be ("- 18").
    wrong_part: str = ""
    correct_part: str = ""
    # One sentence: what the student did between the two lines and why it is wrong.
    what_went_wrong: str = ""
    annotated_correction: str
    key_takeaway: str


class FadedScaffoldingStep(Strict):
    step_number: int = Field(..., ge=1)
    prompt: str
    scaffolding_type: Literal["GIVEN", "PARTIAL_BLANK", "INDEPENDENT"]
    given_content: str
    blank_placeholder: Optional[str] = None
    hint: str


class IndependentTransferProblem(Strict):
    problem_statement: str
    target_pillar_focus: PillarEnum
    metacognitive_checklist: List[str]
    # For the answer key. Empty on worksheets made before the key existed.
    answer: str = ""
    worked_solution: str = ""


class PracticeProblem(Strict):
    """One problem of the practice set (section D), with its answer for the key."""

    problem_statement: str
    difficulty: Literal["WARM_UP", "CORE", "STRETCH"]
    answer: str
    worked_solution: str


class WorksheetContent(Strict):
    title: str
    target_concept: str
    diagnostic_mirror: List[DiagnosticMirrorItem]
    faded_scaffolding: List[FadedScaffoldingStep]
    independent_transfer: IndependentTransferProblem
    # Section D: more problems of the same skill, easy to hard. Empty on older worksheets.
    practice_set: List[PracticeProblem] = Field(default_factory=list)


# ------------------------------------------------------------------------- ledger
class LedgerObservation(Strict):
    submission_id: str
    observed_at: str  # ISO 8601
    strand: str
    score_fraction: float = Field(..., ge=0.0, le=1.0)
    valence: float = Field(..., ge=-1.0, le=1.0)
    mastery_after: float = Field(..., ge=0.0, le=1.0)
    valence_after: float = Field(..., ge=-1.0, le=1.0)
    root_error_count: int = Field(..., ge=0)
    slip_error_count: int = Field(..., ge=0)  # FAC + COM + TST root errors


class StudentLedger(Strict):
    student_id: str = Field(..., pattern=STUDENT_ID_PATTERN)
    mastery_by_strand: dict[str, float] = Field(default_factory=dict)
    valence_ewma: Optional[float] = None
    scaffolding_mode: ScaffoldingModeEnum = ScaffoldingModeEnum.STANDARD_PROGRESSIVE_FADE
    history: List[LedgerObservation] = Field(default_factory=list)


# ------------------------------------------------------------------ API contracts
class Api(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ImageResolution(Api):
    width: int
    height: int


SubmissionStatus = Literal["UPLOADED", "TRANSCRIBING", "GRADING", "GRADED", "NEEDS_RETAKE", "FAILED"]


class SubmissionIngestionPayload(Api):
    submissionId: str
    studentId: str
    course: CourseEnum
    unitTopic: str
    imageResolution: ImageResolution
    sharpnessScore: Optional[float] = None  # null for work imported from Classroom
    isQualityPassed: bool
    uploadedAt: str
    fileUrls: List[str]
    status: SubmissionStatus = "UPLOADED"
    gradingId: Optional[str] = None
    failureCode: Optional[int] = None  # upload failure code (upload_errors.py) when status is NEEDS_RETAKE or FAILED


class ApiPillarBreakdown(Api):
    pillar: PillarEnum
    maxScore: float
    earnedScore: float
    errorCount: int
    feedback: str


class ApiQuestion(Api):
    label: str
    text: str = ""


class ApiStepDiagnostic(Api):
    stepNumber: int
    # Which question the step answers, and its number within that question (1, 2, 3 ...).
    questionLabel: str = ""
    questionStepNumber: int = 0
    studentInput: str
    isCorrect: bool
    pillarImpacted: Optional[PillarEnum] = None
    isCarryForwardProtected: bool
    explanation: str


class ApiEntityExtraction(Api):
    misconceptionId: str
    description: str
    severity: SeverityEnum


class ApiAnswerKeyStep(Api):
    stepNumber: int
    description: str
    expectedMath: str
    isKeyStep: bool = True


class ApiQuestionAnswerKey(Api):
    methodUsed: str
    steps: List[ApiAnswerKeyStep]
    finalAnswer: str
    answerVerification: str


class ApiKeyStepCheck(Api):
    keyStepNumber: int
    keyStepDescription: str
    expectedMath: str
    status: KeyStepStatus
    matchedStudentSteps: List[int] = Field(default_factory=list)
    note: str


class ApiFinalAnswerVerification(Api):
    studentFinalAnswer: str
    resubstitutionCheck: str
    satisfiesInitialQuestion: bool
    discrepancyNote: str = ""


class ApiQuestionDiagnostic(Api):
    questionNumber: str
    problemStatement: str
    totalScore: float
    maxPossibleScore: float
    answerKey: ApiQuestionAnswerKey
    finalAnswerVerification: ApiFinalAnswerVerification
    keyStepChecks: List[ApiKeyStepCheck]
    stepDiagnostics: List[ApiStepDiagnostic]
    entityExtractions: List[ApiEntityExtraction]
    pillarBreakdowns: List[ApiPillarBreakdown]
    supportiveFramingMessage: str = ""


PlanTier = Literal["free", "pro"]


class ApiGrading(Api):
    """Frontend ``Stage2GradingAndAffectOutput``."""

    gradingId: str
    submissionId: str
    studentId: str
    topic: str
    totalScore: float
    maxPossibleScore: float
    affectState: Optional[AffectStateEnum]  # null on the Free plan
    supportiveFramingMessage: str
    pillarBreakdowns: List[ApiPillarBreakdown]
    # Per-question analyses: answer key, key-step coverage, re-substitution check, steps.
    questionAnalyses: List[ApiQuestionDiagnostic] = Field(default_factory=list)
    # Every step on the page, each tagged with its question and its number within it.
    stepDiagnostics: List[ApiStepDiagnostic] = Field(default_factory=list)
    # The questions on the page, in order. Empty (or one entry) for a single question.
    questions: List[ApiQuestion] = []
    entityExtractions: List[ApiEntityExtraction]
    scaffoldingMode: Optional[ScaffoldingModeEnum]  # null on the Free plan
    gradedAt: str
    plan: PlanTier = "pro"  # the plan the work was graded under
    course: Optional[str] = None  # MTH1W / MPM2D, as read from the page
    # QUEUED, PENDING, READY, NOT_NEEDED, PRO_ONLY or FAILED (shown in the upload history).
    worksheetStatus: Optional[str] = None


class ApiDiagnosticMirrorItem(Api):
    previousStepText: str = ""
    originalStepText: str
    wrongPart: str = ""
    correctPart: str = ""
    whatWentWrong: str = ""
    annotatedCorrection: str
    keyTakeaway: str


class ApiFadedScaffoldingStep(Api):
    stepNumber: int
    prompt: str
    scaffoldingType: Literal["GIVEN", "PARTIAL_BLANK", "INDEPENDENT"]
    givenContent: str
    blankPlaceholder: Optional[str] = None
    hint: str


class ApiIndependentTransferProblem(Api):
    problemId: str
    problemStatement: str
    targetPillarFocus: PillarEnum
    metacognitiveChecklist: List[str]
    answer: str = ""
    workedSolution: str = ""


class ApiPracticeProblem(Api):
    number: int
    problemStatement: str
    difficulty: Literal["WARM_UP", "CORE", "STRETCH"]
    answer: str
    workedSolution: str


class ApiWorksheet(Api):
    """Frontend ``WS_3STAGE_V1``."""

    worksheetId: str
    gradingId: str
    title: str
    targetConcept: str
    sectionA_DiagnosticMirror: List[ApiDiagnosticMirrorItem]
    sectionB_FadedScaffolding: List[ApiFadedScaffoldingStep]
    sectionC_IndependentTransfer: ApiIndependentTransferProblem
    sectionD_PracticeSet: List[ApiPracticeProblem] = Field(default_factory=list)


class ApiTrajectoryPoint(Api):
    weekLabel: str
    score: float


class ApiStrandMastery(Api):
    strandName: str
    currentEWMAMastery: float
    historicalTrajectory: List[ApiTrajectoryPoint]


class ApiPillarErrorShare(Api):
    pillar: PillarEnum
    percentageOfTotalErrors: float


class ApiFrictionAlert(Api):
    detectedDate: str
    frictionLevel: AffectStateEnum
    topicContext: str
    actionableParentInsight: str


class ApiParentSummary(Api):
    """Frontend ``ParentProjectionSummary``."""

    studentId: str
    studentName: str
    course: CourseEnum
    overallEqaoForecast: EQAOLevel
    eqaoForecastConfidence: float
    strandMasteries: List[ApiStrandMastery]
    pillarErrorDistribution: List[ApiPillarErrorShare]
    cognitiveFrictionAlerts: List[ApiFrictionAlert]


class ApiLinkedStudent(Api):
    """A student a parent is linked to, by name, for the parent's child picker."""

    studentId: str
    name: str
    course: Optional[CourseEnum] = None


class UserProfile(Api):
    uid: str
    role: Literal["student", "parent", "teacher"]
    name: str
    studentId: Optional[str] = None
    course: Optional[CourseEnum] = None
    linkCode: Optional[str] = None  # students: share with a parent to link accounts
    childStudentIds: List[str] = Field(default_factory=list)
    tenantId: Optional[str] = None
    plan: PlanTier = "free"
    classIds: List[str] = Field(default_factory=list)  # students: classes joined with a code
    tester: bool = False  # testing account: no upload cap, repeat photos allowed (admin-set only)
    hasBilling: bool = False  # has a Stripe customer: show "Manage billing"
    children: List[ApiLinkedStudent] = Field(default_factory=list)  # parents: linked students by name


class TesterViewRequest(Api):
    """Testing accounts only: switch the view (role) and the plan on the fly."""

    model_config = ConfigDict(extra="forbid")
    role: Optional[Literal["student", "parent", "teacher"]] = None
    plan: Optional[PlanTier] = None
    course: Optional[CourseEnum] = None  # used when a student profile has to be made


class AddRosterStudentRequest(Api):
    """A teacher adds a student who has an account, with the student's link code."""

    linkCode: str = Field(..., min_length=6, max_length=12)


class RegisterRequest(Api):
    role: Literal["student", "parent", "teacher"]
    name: str = Field(..., min_length=1, max_length=80)
    course: Optional[CourseEnum] = None


class LinkChildRequest(Api):
    linkCode: str = Field(..., min_length=6, max_length=12)


class UpdateProfileRequest(Api):
    name: str = Field(..., min_length=1, max_length=80)


class JoinClassRequest(Api):
    joinCode: str = Field(..., min_length=6, max_length=12)


class ApiClass(Api):
    classId: str
    className: str
    gradeLevel: int
    schoolId: str
    schoolName: str


class CreateSchoolRequest(Api):
    """Admin only: there are no teacher accounts at launch."""

    schoolName: str = Field(..., min_length=1, max_length=255)
    tenantId: Optional[str] = Field(default=None, pattern=TENANT_ID_PATTERN)  # omit to create a new tenant
    organizationName: Optional[str] = Field(default=None, max_length=255)
    districtCode: Optional[str] = Field(default=None, max_length=64)


class CreateClassRequest(Api):
    className: str = Field(..., min_length=1, max_length=128)
    gradeLevel: int = Field(..., ge=3, le=12)


class SetPlanRequest(Api):
    plan: PlanTier


class SetTesterRequest(Api):
    """Admin: mark a testing account. Give the sign-in email or the uid."""

    model_config = ConfigDict(extra="forbid")
    email: Optional[str] = Field(None, max_length=254)
    uid: Optional[str] = Field(None, max_length=128)
    tester: bool = True

    @model_validator(mode="after")
    def _one_of(self):
        if not (self.email or self.uid):
            raise ValueError("Give email or uid")
        return self


ClassroomBetaStatus = Literal["none", "pending", "approved", "declined"]


class ClassroomBetaRequest(Api):
    """A Pro teacher asks to join the Google Classroom test group. Google only lets
    accounts listed as Test users connect, so Maalik adds this email by hand."""

    model_config = ConfigDict(extra="forbid")
    googleEmail: str = Field(..., min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SetClassroomBetaRequest(Api):
    """Admin: approve or decline a Classroom beta request, by uid or Google email."""

    model_config = ConfigDict(extra="forbid")
    uid: Optional[str] = Field(None, max_length=128)
    googleEmail: Optional[str] = Field(None, max_length=254)
    status: Literal["approved", "declined", "pending"]

    @model_validator(mode="after")
    def _one_of(self):
        if not (self.uid or self.googleEmail):
            raise ValueError("Give uid or googleEmail")
        return self


class ApiUsage(Api):
    """Upload allowance for one student this calendar month (UTC)."""

    studentId: str
    plan: PlanTier
    monthlyLimit: Optional[int]  # null = unlimited
    usedThisMonth: int
    remaining: Optional[int]
    resetsAt: str  # first moment of next month, ISO 8601


class CreateUploadRequest(Api):
    studentId: str = Field(..., pattern=STUDENT_ID_PATTERN)
    course: CourseEnum
    unitTopic: str = Field(..., min_length=1, max_length=200)
    sharpnessScore: float = Field(..., ge=0, le=100)


class ApiUploadTicket(Api):
    uploadId: str
    uploadUrl: str  # relative to the API; PUT the raw image bytes here, no Authorization header
    method: Literal["PUT"] = "PUT"
    expiresAt: str
    maxBytes: int


PROBLEM_LABEL_MAX = 500


class CreatePhoneUploadRequest(Api):
    """Ask for a phone camera link (shown as a QR code). ``new`` starts a new upload
    for ``studentId``; ``addPhotos`` adds photos to the earlier upload ``submissionId``."""
    kind: Literal["new", "addPhotos"] = "new"
    studentId: Optional[str] = Field(None, pattern=STUDENT_ID_PATTERN)
    submissionId: Optional[str] = Field(None, max_length=64)
    # The worksheet problem the photo is for, shown on the phone ("" for a whole page).
    worksheetGradingId: Optional[str] = Field(None, max_length=64)
    problem: str = Field("", max_length=PROBLEM_LABEL_MAX)
    # A student's Google Classroom assignment the photo is for.
    classroomCourseId: Optional[str] = Field(None, max_length=64)
    classroomWorkId: Optional[str] = Field(None, max_length=64)


class ApiPhoneUploadLink(Api):
    sessionId: str
    token: str  # goes in the QR code's link (after #) and is never stored
    expiresAt: str
    maxFiles: int


class ApiPhoneUpload(Api):
    sessionId: str
    kind: Literal["new", "addPhotos"]
    problem: str = ""
    # WAITING -> PROCESSING -> DONE; NEEDS_RETAKE (unreadable, send another), FAILED,
    # EXPIRED (15 minutes passed), CANCELLED (the upload window was closed).
    state: Literal["WAITING", "PROCESSING", "DONE", "NEEDS_RETAKE", "FAILED", "EXPIRED", "CANCELLED"]
    expiresAt: str
    maxFiles: int
    submissionId: Optional[str] = None  # only shown to the signed-in computer
    failureCode: Optional[int] = None


class ClassroomImportRequest(Api):
    course: CourseEnum
    unitTopic: str = Field(..., min_length=1, max_length=200)


class ApiRosterStudent(Api):
    """A student a teacher imported from Google Classroom or another LMS."""

    studentId: str
    name: str
    course: CourseEnum
    googleCourseId: Optional[str] = None
    lmsProvider: Optional[str] = None
    lmsCourseId: Optional[str] = None
    linkedAccount: bool = False  # added with the student's link code: they have their own account


class ApiImportedWork(Api):
    studentId: str
    studentName: str
    submissionId: str


class ApiSkippedWork(Api):
    studentName: str
    reason: str


class ApiClassroomImport(Api):
    imported: List[ApiImportedWork]
    skipped: List[ApiSkippedWork]


LmsProviderId = Literal["google_classroom", "brightspace", "canvas", "microsoft_edu"]


class LmsConnectRequest(Api):
    instanceUrl: Optional[str] = Field(default=None, max_length=255)


class ApiClassroomRubricLevel(Api):
    title: str = ""
    points: Optional[float] = None


class ApiClassroomRubricCriterion(Api):
    title: str = ""
    description: str = ""
    levels: List[ApiClassroomRubricLevel] = []


class ApiClassroomStudentWork(Api):
    """One assignment in a student's own Google Classroom class."""
    id: str
    title: str
    description: str = ""
    maxPoints: Optional[float] = None
    dueDate: Optional[str] = None
    link: Optional[str] = None
    state: Optional[str] = None          # the student's submission state in Classroom
    assignedGrade: Optional[float] = None  # the teacher's returned grade
    rubric: List[ApiClassroomRubricCriterion] = []
    submissionId: Optional[str] = None   # the student's latest BirdBrains upload for it
    gradingId: Optional[str] = None


class ApiLmsProviderStatus(Api):
    id: LmsProviderId
    name: str
    configured: bool
    connected: bool
    requiresInstanceUrl: bool
    defaultPlaceholder: str = ""
    instanceUrl: Optional[str] = None
    plan: PlanTier
    beta: Optional[ClassroomBetaStatus] = None  # Google Classroom only: the teacher's test-group status


class LmsSyncRequest(Api):
    submissionIds: Optional[List[str]] = None


class ApiLmsSyncedItem(Api):
    submissionId: str
    studentName: str
    score: float
    maxScore: float


class ApiLmsSyncResult(Api):
    synced: List[ApiLmsSyncedItem]
    skipped: List[ApiSkippedWork]


# ------------------------------------------------------------ progress + class reports
class ApiProgressPoint(Api):
    date: str  # ISO 8601
    strand: str
    scoreFraction: float
    masteryAfter: float
    rootErrors: int
    valence: Optional[float] = None  # Pro only


class ApiErrorCodeCount(Api):
    code: str
    name: str
    pillar: PillarEnum
    count: int
    students: int = 1  # class report: how many students made this error
    lastSeen: str


class ApiStrandLevel(Api):
    strandName: str
    mastery: float


class ApiProgressReport(Api):
    """One student's results over time (longitudinal)."""

    studentId: str
    studentName: str
    course: CourseEnum
    plan: PlanTier
    uploads: int
    firstUploadAt: Optional[str] = None
    lastUploadAt: Optional[str] = None
    averageMastery: Optional[float] = None
    masteryByStrand: List[ApiStrandLevel]
    timeline: List[ApiProgressPoint]
    errorCodes: List[ApiErrorCodeCount]
    recurringCodes: List[str]  # given on two or more uploads
    pillarErrorDistribution: List[ApiPillarErrorShare]


class ApiCohortStudent(Api):
    studentId: str
    studentName: str
    uploads: int
    lastUploadAt: Optional[str] = None
    averageMastery: Optional[float] = None
    topCode: Optional[str] = None
    recurringCodes: List[str]
    needsAttention: bool


class ApiCohortReport(Api):
    """A teacher's class at a glance (cohort)."""

    googleCourseId: Optional[str] = None
    students: List[ApiCohortStudent]
    uploads: int
    masteryByStrand: List[ApiStrandLevel]
    errorCodes: List[ApiErrorCodeCount]
    pillarErrorDistribution: List[ApiPillarErrorShare]
