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

from pydantic import BaseModel, ConfigDict, Field

STUDENT_ID_PATTERN = r"^stu_[a-zA-Z0-9]{12}$"
SUBMISSION_ID_PATTERN = r"^sub_[a-zA-Z0-9]{12}$"
GRADING_ID_PATTERN = r"^grd_[a-zA-Z0-9]{12}$"
WORKSHEET_ID_PATTERN = r"^wks_[a-zA-Z0-9]{12}$"
ERROR_CODE_PATTERN = r"^(CON|PRC|FAC|TST)-\d{2}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- enums
class PillarEnum(str, Enum):
    CON = "CON"  # Conceptual Errors
    PRC = "PRC"  # Procedural Errors
    FAC = "FAC"  # Factual & Calculation Fluency
    TST = "TST"  # Test-Taking & Communication Habits


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


class Stage1TranscriptionOutput(Strict):
    submission_id: str
    overall_ocr_confidence: float = Field(..., ge=0.0, le=1.0)
    lines: List[Stage1LineTranscription]
    requires_hitl: bool = Field(default=False)


# ------------------------------------------------------------------ Stage 2 output
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


class PillarScore(Strict):  # extension
    pillar: PillarEnum
    max_score: float = Field(..., ge=0.0)
    earned_score: float = Field(..., ge=0.0)
    feedback: str


class Stage2GradingAndAffectOutput(Strict):
    submission_id: str
    step_evaluations: List[StepEvaluation]
    identified_errors: List[RootCauseErrorItem]
    sentiment_entities: List[SentimentEntityExtraction]
    aggregate_valence: float = Field(..., ge=-1.0, le=1.0)
    aggregate_friction: float = Field(..., ge=0.0, le=1.0)
    recommended_scaffolding_mode: ScaffoldingModeEnum
    # extensions
    pillar_scores: List[PillarScore] = Field(default_factory=list)
    supportive_framing_message: str = ""
    parent_insight: str = ""


# ------------------------------------------------------- worksheet (batch output)
class DiagnosticMirrorItem(Strict):
    original_step_text: str
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


class WorksheetContent(Strict):
    title: str
    target_concept: str
    diagnostic_mirror: List[DiagnosticMirrorItem]
    faded_scaffolding: List[FadedScaffoldingStep]
    independent_transfer: IndependentTransferProblem


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
    slip_error_count: int = Field(..., ge=0)  # FAC + TST root errors


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
    sharpnessScore: float
    isQualityPassed: bool
    uploadedAt: str
    fileUrls: List[str]
    status: SubmissionStatus = "UPLOADED"
    gradingId: Optional[str] = None


class ApiPillarBreakdown(Api):
    pillar: PillarEnum
    maxScore: float
    earnedScore: float
    errorCount: int
    feedback: str


class ApiStepDiagnostic(Api):
    stepNumber: int
    studentInput: str
    isCorrect: bool
    pillarImpacted: Optional[PillarEnum] = None
    isCarryForwardProtected: bool
    explanation: str


class ApiEntityExtraction(Api):
    misconceptionId: str
    description: str
    severity: SeverityEnum


class ApiGrading(Api):
    """Frontend ``Stage2GradingAndAffectOutput``."""

    gradingId: str
    submissionId: str
    studentId: str
    topic: str
    totalScore: float
    maxPossibleScore: float
    affectState: AffectStateEnum
    supportiveFramingMessage: str
    pillarBreakdowns: List[ApiPillarBreakdown]
    stepDiagnostics: List[ApiStepDiagnostic]
    entityExtractions: List[ApiEntityExtraction]
    scaffoldingMode: ScaffoldingModeEnum
    gradedAt: str


class ApiDiagnosticMirrorItem(Api):
    originalStepText: str
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


class ApiWorksheet(Api):
    """Frontend ``WS_3STAGE_V1``."""

    worksheetId: str
    gradingId: str
    title: str
    targetConcept: str
    sectionA_DiagnosticMirror: List[ApiDiagnosticMirrorItem]
    sectionB_FadedScaffolding: List[ApiFadedScaffoldingStep]
    sectionC_IndependentTransfer: ApiIndependentTransferProblem


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


class UserProfile(Api):
    uid: str
    role: Literal["student", "parent"]
    name: str
    studentId: Optional[str] = None
    course: Optional[CourseEnum] = None
    linkCode: Optional[str] = None  # students: share with a parent to link accounts
    childStudentIds: List[str] = Field(default_factory=list)


class RegisterRequest(Api):
    role: Literal["student", "parent"]
    name: str = Field(..., min_length=1, max_length=80)
    course: Optional[CourseEnum] = None


class LinkChildRequest(Api):
    linkCode: str = Field(..., min_length=6, max_length=12)
