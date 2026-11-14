// The 16 official BirdBrains error codes (Freelancer Manual section 2.1).
// Mirrors ERROR_CODES in backend/birdbrains/taxonomy.py: change both together.

export const ERROR_CODE_NAMES: Record<string, string> = {
  'CON-01': 'Foundational Misconception',
  'CON-02': 'Formula/Law Misselection',
  'CON-03': 'Representation / Variable Confusion',
  'CON-04': 'Sign / Vector Direction Misconception',
  'PRC-01': 'Algorithmic Step Omission',
  'PRC-02': 'Order of Operations / Sequencing',
  'PRC-03': 'Algebraic Manipulation / Sign Failure',
  'PRC-04': 'Incomplete Simplification',
  'FAC-01': 'Basic Arithmetic / Math Fact Slip',
  'FAC-02': 'Transcription / Copy Error',
  'FAC-03': 'Unit Conversion / Constant Recall',
  'FAC-04': 'Rounding / Significant Figures',
  'TST-01': 'Prompt Constraint Misread',
  'TST-02': 'Missing Units / Communication Gap',
  'TST-03': 'Unanswered / Time-Attrition Blank',
  'TST-04': 'Distractor Trap / Illegible Work',
};

export function errorCodeName(code: string): string | undefined {
  return ERROR_CODE_NAMES[code];
}
