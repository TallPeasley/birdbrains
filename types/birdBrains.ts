export type GradeCourse = 'MTH1W' | 'MPM2D';
export type AffectState = 'CONFIDENT' | 'NEUTRAL' | 'MILD_FRICTION' | 'HIGH_FRICTION_FRUSTRATION';
export type EQAOLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
export type PillarCategory = 'CONCEPTUAL' | 'PROCEDURAL' | 'REPRESENTATION' | 'COMMUNICATION';

export interface SubmissionIngestionPayload {
  submissionId: string;
  studentId: string;
  course: GradeCourse;
  unitTopic: string;
  imageResolution: {
    width: number;
    height: number;
  };
  sharpnessScore: number; // 0 to 100 scale
  isQualityPassed: boolean;
  uploadedAt: string;
  fileUrls: string[];
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
  studentInput: string;
  isCorrect: boolean;
  pillarImpacted?: PillarCategory;
  isCarryForwardProtected: boolean;
  explanation: string;
}

export interface Stage2GradingAndAffectOutput {
  gradingId: string;
  submissionId: string;
  studentId: string;
  topic: string;
  totalScore: number;
  maxPossibleScore: number;
  affectState: AffectState;
  supportiveFramingMessage: string;
  pillarBreakdowns: PillarBreakdown[];
  stepDiagnostics: StepDiagnostic[];
  entityExtractions: {
    misconceptionId: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}

export interface DiagnosticMirrorItem {
  originalStepText: string;
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
