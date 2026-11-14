import { PILLARS } from '@/lib/pillars';
import type { PillarCategory } from '@/types/birdBrains';

/**
 * Plain-words explanations for the 16 official BirdBrains error codes,
 * written for a Grade 9–10 student. Keyed by code (CON-01 ... TST-04).
 */
export const ERROR_CODE_HELP: Record<string, string> = {
  'CON-01': 'A core math rule was mixed up, like adding the bottoms of two fractions.',
  'CON-02': 'The formula or rule used here does not fit this type of question.',
  'CON-03': 'Numbers or letters from the question went into the wrong spots in the equation.',
  'CON-04': 'A plus or minus sign, or a direction on the graph, was set up the wrong way.',
  'PRC-01': 'A needed step in the method was skipped.',
  'PRC-02': 'The steps were done in the wrong order.',
  'PRC-03': 'A sign or a number got lost when moving terms around.',
  'PRC-04': 'The work stopped a step or two before the answer was fully simplified.',
  'FAC-01': 'The steps make sense, with a small calculation slip in the numbers.',
  'FAC-02': 'A number or sign changed when copying from one line to the next.',
  'FAC-03': 'A unit conversion or a standard number from a formula was off.',
  'FAC-04': 'A number was rounded too early or to the wrong decimal place.',
  'TST-01': 'The work solved for something slightly different from what the question asked.',
  'TST-02': 'The final answer is missing units or a closing sentence.',
  'TST-03': 'This part was left blank or unfinished.',
  'TST-04': 'A middle step was treated as the final answer, or handwriting on one line got misread.',
};

/** Plain-words explanation for an error code. Unknown codes fall back to the code itself. */
export function errorCodeHelp(code: string): string {
  return ERROR_CODE_HELP[code] ?? code;
}

/** Pillar for an error code prefix (CON, PRC, FAC, TST), or undefined when unknown. */
export function errorCodePillar(code: string): PillarCategory | undefined {
  const prefix = code.split('-')[0] as PillarCategory;
  return prefix in PILLARS ? prefix : undefined;
}
