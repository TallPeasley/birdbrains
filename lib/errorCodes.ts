// The 24 six-pillar error codes (backend/birdbrains/taxonomy.py, approved 2026-11-25).
// The codes (CON-01 ... TST-06) stay as internal ids; people see the plain names below.
// Mirrors ERROR_CODES in backend/birdbrains/taxonomy.py: change both together.
import type { PillarCategory } from '@/types/birdBrains';

/** Retired four-pillar ids -> their six-pillar id. Old ids are never reused. */
export const LEGACY_CODES: Record<string, string> = {
  'CON-02': 'STR-01',
  'CON-03': 'STR-02',
  'TST-01': 'COM-01',
  'TST-02': 'COM-02',
};

/** The six-pillar id for a code (old ids are remapped; others pass through). */
export function currentCode(code: string): string {
  return LEGACY_CODES[code] ?? code;
}

/** Technical names. Kept for staff tools and search; not shown to students or parents. */
export const ERROR_CODE_NAMES: Record<string, string> = {
  'CON-01': 'Foundational Misconception',
  'CON-04': 'Sign / Direction Misconception',
  'CON-05': 'Overgeneralised Rule',
  'CON-06': 'Domain / Restriction Blindness',
  'STR-01': 'Formula / Law Misselection',
  'STR-02': 'Setup / Representation Error',
  'STR-03': 'No Viable Plan',
  'STR-04': 'Unsuitable Method',
  'PRC-01': 'Algorithmic Step Omission',
  'PRC-02': 'Order of Operations / Sequencing',
  'PRC-03': 'Algebraic Manipulation / Sign Failure',
  'PRC-04': 'Incomplete Simplification',
  'FAC-01': 'Basic Arithmetic / Math Fact Slip',
  'FAC-02': 'Transcription / Copy Error',
  'FAC-03': 'Unit Conversion / Constant Recall',
  'FAC-04': 'Rounding / Significant Figures',
  'COM-01': 'Prompt Constraint Misread',
  'COM-02': 'Missing Units / Concluding Statement',
  'COM-03': 'Notation / Layout Misuse',
  'COM-04': 'Unsupported Answer',
  'TST-03': 'Unanswered / Time-Attrition Blank',
  'TST-04': 'Distractor Trap',
  'TST-05': 'Abandoned Work',
  'TST-06': 'Unchecked Unreasonable Answer',
};

/** What people see: a short, plain name for each kind of mistake. */
export const MISTAKE_NAMES: Record<string, string> = {
  'CON-01': 'Mixed-up math rule',
  'CON-04': 'Sign or direction set up backwards',
  'CON-05': 'Rule used where it does not work',
  'CON-06': 'Value that is not allowed',
  'STR-01': 'Wrong formula for this question',
  'STR-02': 'Question set up wrong',
  'STR-03': 'No clear plan',
  'STR-04': 'Method that does not fit',
  'PRC-01': 'Skipped a step',
  'PRC-02': 'Steps done out of order',
  'PRC-03': 'Sign or term lost while rearranging',
  'PRC-04': 'Not fully simplified',
  'FAC-01': 'Calculation slip',
  'FAC-02': 'Copied a number wrong',
  'FAC-03': 'Unit or constant slip',
  'FAC-04': 'Rounding slip',
  'COM-01': 'Answered a different question',
  'COM-02': 'Missing units or final sentence',
  'COM-03': 'Hard-to-follow working',
  'COM-04': 'Answer not explained',
  'TST-03': 'Left blank or unfinished',
  'TST-04': 'Middle step taken as the answer',
  'TST-05': 'Gave up partway',
  'TST-06': 'Answer not checked',
};

/** Technical name (staff wording). */
export function errorCodeName(code: string): string | undefined {
  return ERROR_CODE_NAMES[currentCode(code)];
}

/** Plain name for a mistake code, e.g. "PRC-03" -> "Sign or term lost while rearranging". */
export function mistakeName(code: string, fallback?: string): string {
  return MISTAKE_NAMES[currentCode(code)] ?? fallback ?? 'Other mistake';
}

const PILLAR_KEYS: PillarCategory[] = ['CON', 'STR', 'PRC', 'FAC', 'COM', 'TST'];

/** Pillar a code belongs to (its prefix after remapping old ids), or undefined. */
export function codePillar(code: string): PillarCategory | undefined {
  const prefix = currentCode(code).split('-')[0] as PillarCategory;
  return PILLAR_KEYS.includes(prefix) ? prefix : undefined;
}

/** One entry per kind of mistake, with how many times it came up, in first-seen order. */
export function uniqueMistakes<T extends { misconceptionId: string }>(items: T[]): (T & { count: number })[] {
  const seen = new Map<string, T & { count: number }>();
  for (const item of items) {
    const id = currentCode(item.misconceptionId);
    const got = seen.get(id);
    if (got) got.count += 1;
    else seen.set(id, { ...item, misconceptionId: id, count: 1 });
  }
  return Array.from(seen.values());
}
