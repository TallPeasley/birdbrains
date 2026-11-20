export type GradeCourse = 'MTH1W' | 'MPM2D';
/** Affect states from the AI pipeline spec. */
export type AffectState =
  | 'CONFIDENT_MASTERY'
  | 'PRODUCTIVE_STRUGGLE'
  | 'HIGH_FRICTION_FRUSTRATION'
  | 'COGNITIVE_OVERLOAD_AVOIDANCE'
  | 'RUSHED_CARELESSNESS';
export type ScaffoldingMode =
  | 'HIGH_SUPPORT_DEESCALATION'
  | 'METACOGNITIVE_SPEED_BUMP'
  | 'STANDARD_PROGRESSIVE_FADE';
export type SubmissionStatus = 'UPLOADED' | 'TRANSCRIBING' | 'GRADING' | 'GRADED' | 'NEEDS_RETAKE' | 'FAILED';
export type EQAOLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
/** Four-Pillar Taxonomy from the AI pipeline spec: Conceptual, Procedural,
 *  Factual & Calculation Fluency, Test-Taking & Communication Habits. */
export type PillarCategory = 'CON' | 'PRC' | 'FAC' | 'TST';

export interface SubmissionIngestionPayload {
  submissionId: string;
  studentId: string;
  course: GradeCourse;
  unitTopic: string;
  imageResolution: {
    width: number;
    height: number;
  };
  sharpnessScore: number | null; // 0 to 100 scale; null for work imported from Classroom
  isQualityPassed: boolean;
  uploadedAt: string;
  fileUrls: string[];
  /** Set by the backend. */
  status?: SubmissionStatus;
  gradingId?: string | null;
  /** Upload failure code when status is NEEDS_RETAKE or FAILED (lib/uploadErrors.ts). */
  failureCode?: number | null;
}

export interface PillarBreakdown {
  pillar: PillarCategory;
  maxScore: number;
  earnedScore: number;
  errorCount: number;
  feedback: string;
}

export interface StepDiagnostic {
  stepNumber: number;
  /** The question this step answers ("" when the page has one question), and its number within it. */
  questionLabel?: string;
  questionStepNumber?: number;
  studentInput: string;
  isCorrect: boolean;
  pillarImpacted?: PillarCategory;
  isCarryForwardProtected: boolean;
  explanation: string;
}

export interface AnswerKeyStep {
  stepNumber: number;
  description: string;
  expectedMath: string;
  isKeyStep: boolean;
}

export interface QuestionAnswerKey {
  methodUsed: string;
  steps: AnswerKeyStep[];
  finalAnswer: string;
  answerVerification: string;
}

export type KeyStepCheckStatus = 'PRESENT' | 'PRESENT_WITH_ERROR' | 'MISSING' | 'EQUIVALENT_METHOD';

export interface KeyStepCheck {
  keyStepNumber: number;
  keyStepDescription: string;
  expectedMath: string;
  status: KeyStepCheckStatus;
  matchedStudentSteps: number[];
  note: string;
}

export interface FinalAnswerVerification {
  studentFinalAnswer: string;
  resubstitutionCheck: string;
  satisfiesInitialQuestion: boolean;
  discrepancyNote: string;
}

export interface QuestionDiagnostic {
  questionNumber: string;
  problemStatement: string;
  totalScore: number;
  maxPossibleScore: number;
  answerKey: QuestionAnswerKey;
  finalAnswerVerification: FinalAnswerVerification;
  keyStepChecks: KeyStepCheck[];
  stepDiagnostics: StepDiagnostic[];
  entityExtractions: {
    misconceptionId: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
  pillarBreakdowns: PillarBreakdown[];
  supportiveFramingMessage?: string;
}

export interface Stage2GradingAndAffectOutput {
  gradingId: string;
  submissionId: string;
  studentId: string;
  topic: string;
  totalScore: number;
  maxPossibleScore: number;
  /** null on the Free plan (mood is a Pro feature). */
  affectState: AffectState | null;
  supportiveFramingMessage: string;
  pillarBreakdowns: PillarBreakdown[];
  /** Separate per-question analyses (each with answer key, key-step coverage,
   *  re-substitution check, isolated steps, and errors). */
  questionAnalyses?: QuestionDiagnostic[];
  /** Legacy / single-question flat step list; empty on multi-question worksheets. */
  stepDiagnostics: StepDiagnostic[];
  /** The printed questions on the page, in order. Empty on gradings made before questions were split. */
  questions?: { label: string; text: string }[];
  entityExtractions: {
    misconceptionId: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
  /** Set by the backend. */
  /** null on the Free plan. */
  scaffoldingMode?: ScaffoldingMode | null;
  /** The plan the work was graded under. */
  plan?: PlanTier;
  gradedAt?: string;
}

export interface DiagnosticMirrorItem {
  /** The student's line just before the mistake. Empty on worksheets made before this existed. */
  previousStepText?: string;
  originalStepText: string;
  /** The exact piece of originalStepText that is wrong (e.g. "- 9"), and what it should be ("- 18"). */
  wrongPart?: string;
  correctPart?: string;
  /** One sentence: what happened between the two lines and why it is wrong. */
  whatWentWrong?: string;
  annotatedCorrection: string;
  keyTakeaway: string;
}

export interface FadedScaffoldingStep {
  stepNumber: number;
  prompt: string;
  scaffoldingType: 'GIVEN' | 'PARTIAL_BLANK' | 'INDEPENDENT';
  givenContent: string;
  blankPlaceholder?: string;
  hint: string;
}

export interface IndependentTransferProblem {
  problemId: string;
  problemStatement: string;
  targetPillarFocus: PillarCategory;
  metacognitiveChecklist: string[];
}

export interface WS_3STAGE_V1 {
  worksheetId: string;
  gradingId: string;
  title: string;
  targetConcept: string;
  sectionA_DiagnosticMirror: DiagnosticMirrorItem[];
  sectionB_FadedScaffolding: FadedScaffoldingStep[];
  sectionC_IndependentTransfer: IndependentTransferProblem;
}

export interface StrandMastery {
  strandName: string;
  currentEWMAMastery: number; // 0.0 to 1.0
  historicalTrajectory: {
    weekLabel: string;
    score: number;
  }[];
}

export interface ParentProjectionSummary {
  studentId: string;
  studentName: string;
  course: GradeCourse;
  overallEqaoForecast: EQAOLevel;
  eqaoForecastConfidence: number; // 0 to 100 percentage
  strandMasteries: StrandMastery[];
  pillarErrorDistribution: {
    pillar: PillarCategory;
    percentageOfTotalErrors: number;
  }[];
  cognitiveFrictionAlerts: {
    detectedDate: string;
    frictionLevel: AffectState;
    topicContext: string;
    actionableParentInsight: string;
  }[];
}

export interface UserProfile {
  uid: string;
  role: 'student' | 'parent' | 'teacher';
  name: string;
  studentId?: string | null;
  course?: GradeCourse | null;
  /** Students: share with a parent so they can link their account. */
  linkCode?: string | null;
  childStudentIds: string[];
  tenantId?: string | null;
  /** Free by default. A parent on Pro covers every linked child. */
  plan?: PlanTier;
  /** Students: classes joined with a class code. */
  classIds?: string[];
  tester?: boolean; // testing account: no upload cap, repeat photos allowed (set by an admin only)
}

/** A class a student joined with a code (GET /me/classes). */
export interface ApiClass {
  classId: string;
  className: string;
  gradeLevel: number; // 3 to 12
  schoolId: string;
  schoolName: string;
}

export type PlanTier = 'free' | 'pro';

/** Upload allowance for one student this calendar month (GET /students/{id}/usage). */
export interface ApiUsage {
  studentId: string;
  plan: PlanTier;
  monthlyLimit: number | null; // null = unlimited (Pro)
  usedThisMonth: number;
  remaining: number | null;
  resetsAt: string; // ISO 8601, first moment of next month (UTC)
}

/** One-time upload link for the Chrome extension (POST /uploads). */
export interface ApiUploadTicket {
  uploadId: string;
  /** Relative to the API. PUT the raw image bytes here; no Authorization header. Works once. */
  uploadUrl: string;
  method: 'PUT';
  expiresAt: string;
  maxBytes: number;
}

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string | null;
}

export interface ClassroomCoursework {
  id: string;
  title: string;
}

/** A student a teacher imported from Google Classroom or another LMS. */
export interface RosterStudent {
  studentId: string;
  name: string;
  course: GradeCourse;
  googleCourseId?: string | null;
  lmsProvider?: LmsProviderId | null;
  lmsCourseId?: string | null;
}

export interface ClassroomImportResult {
  imported: { studentId: string; studentName: string; submissionId: string }[];
  skipped: { studentName: string; reason: string }[];
}

export type LmsProviderId = 'google_classroom' | 'brightspace' | 'canvas' | 'microsoft_edu';

export interface LmsProviderStatus {
  id: LmsProviderId;
  name: string;
  configured: boolean;
  connected: boolean;
  requiresInstanceUrl: boolean;
  defaultPlaceholder: string;
  instanceUrl?: string | null;
  plan: PlanTier;
}

export interface LmsSyncResult {
  synced: { submissionId: string; studentName: string; score: number; maxScore: number }[];
  skipped: { studentName: string; reason: string }[];
}

/** GET /students/{id}/progress: one student's results over time. */
export interface ProgressPoint {
  date: string;
  strand: string;
  scoreFraction: number;
  masteryAfter: number;
  rootErrors: number;
  /** Mood trend, -1 to 1. Null on the Free plan. */
  valence: number | null;
}

export interface ErrorCodeCount {
  code: string;
  name: string;
  pillar: PillarCategory;
  count: number;
  /** Class report: how many students made this error. */
  students: number;
  lastSeen: string;
}

export interface StrandLevel {
  strandName: string;
  mastery: number;
}

export interface ProgressReport {
  studentId: string;
  studentName: string;
  course: GradeCourse;
  plan: PlanTier;
  uploads: number;
  firstUploadAt: string | null;
  lastUploadAt: string | null;
  averageMastery: number | null;
  masteryByStrand: StrandLevel[];
  timeline: ProgressPoint[];
  errorCodes: ErrorCodeCount[];
  /** Codes given on two or more uploads. */
  recurringCodes: string[];
  pillarErrorDistribution: { pillar: PillarCategory; percentageOfTotalErrors: number }[];
}

/** GET /teacher/report: a Pro teacher's class at a glance. */
export interface CohortStudent {
  studentId: string;
  studentName: string;
  uploads: number;
  lastUploadAt: string | null;
  averageMastery: number | null;
  topCode: string | null;
  recurringCodes: string[];
  needsAttention: boolean;
}

export interface CohortReport {
  googleCourseId: string | null;
  students: CohortStudent[];
  uploads: number;
  masteryByStrand: StrandLevel[];
  errorCodes: ErrorCodeCount[];
  pillarErrorDistribution: { pillar: PillarCategory; percentageOfTotalErrors: number }[];
}
