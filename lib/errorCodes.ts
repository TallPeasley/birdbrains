// The 16 official BirdBrains error codes (Freelancer Manual section 2.1).
// The codes (CON-01 ... TST-04) stay as internal ids; people see the plain names below.
// Mirrors ERROR_CODES in backend/birdbrains/taxonomy.py: change both together.

/** The manual's technical names. Kept for staff tools and search; not shown to students or parents. */
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

/** What people see: a short, plain name for each kind of mistake. */
export const MISTAKE_NAMES: Record<string, string> = {
  'CON-01': 'Mixed-up math rule',
  'CON-02': 'Wrong formula for this question',
  'CON-03': 'Values put in the wrong places',
  'CON-04': 'Sign or direction set up backwards',
  'PRC-01': 'Skipped a step',
  'PRC-02': 'Steps done out of order',
  'PRC-03': 'Sign or term lost while rearranging',
  'PRC-04': 'Not fully simplified',
  'FAC-01': 'Calculation slip',
  'FAC-02': 'Copied a number wrong',
  'FAC-03': 'Unit or constant slip',
  'FAC-04': 'Rounding slip',
  'TST-01': 'Answered a different question',
  'TST-02': 'Missing units or final sentence',
  'TST-03': 'Left blank or unfinished',
  'TST-04': 'Stopped at a middle step',
};

/** The manual's technical name (staff wording). */
export function errorCodeName(code: string): string | undefined {
  return ERROR_CODE_NAMES[code];
}

/** Plain name for a mistake code, e.g. "PRC-03" -> "Sign or term lost while rearranging". */
export function mistakeName(code: string, fallback?: string): string {
  return MISTAKE_NAMES[code] ?? fallback ?? 'Other mistake';
}

/** One entry per kind of mistake, with how many times it came up, in first-seen order. */
export function uniqueMistakes<T extends { misconceptionId: string }>(items: T[]): (T & { count: number })[] {
  const seen = new Map<string, T & { count: number }>();
  for (const item of items) {
    const got = seen.get(item.misconceptionId);
    if (got) got.count += 1;
    else seen.set(item.misconceptionId, { ...item, count: 1 });
  }
  return Array.from(seen.values());
}
