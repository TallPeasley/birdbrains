import { codePillar, currentCode } from '@/lib/errorCodes';
import type { PillarCategory } from '@/types/birdBrains';

/**
 * Plain-words explanations for the 24 six-pillar error codes,
 * written for a Grade 9–10 student. Keyed by code (CON-01 ... TST-06).
 */
export const ERROR_CODE_HELP: Record<string, string> = {
  'CON-01': 'A core math rule was mixed up, like adding the bottoms of two fractions.',
  'CON-04': 'A plus or minus sign, or a direction on the graph, was understood the wrong way.',
  'CON-05': 'A rule was used where it does not work, like squaring each term of (a + b) separately.',
  'CON-06': 'The answer uses a value that is not allowed here, like dividing by zero or a negative length.',
  'STR-01': 'The formula or rule used here does not fit this type of question.',
  'STR-02': 'Numbers or letters from the question went into the wrong spots in the equation.',
  'STR-03': 'The first move here could not lead to the answer. Plan the method before writing.',
  'STR-04': 'This method works, but it is not the one asked for, or it makes the question much longer.',
  'PRC-01': 'A needed step in the method was skipped.',
  'PRC-02': 'The steps were done in the wrong order.',
  'PRC-03': 'A sign or a number got lost when moving terms around.',
  'PRC-04': 'The work stopped a step or two before the answer was fully simplified.',
  'FAC-01': 'The steps make sense, with a small calculation slip in the numbers.',
  'FAC-02': 'A number or sign changed when copying from one line to the next.',
  'FAC-03': 'A unit conversion or a standard number from a formula was off.',
  'FAC-04': 'A number was rounded too early or to the wrong decimal place.',
  'COM-01': 'The work solved for something slightly different from what the question asked.',
  'COM-02': 'The final answer is missing units or a closing sentence.',
  'COM-03': 'The working is hard to follow, like a long chain of equals signs or missing brackets.',
  'COM-04': 'The answer is there, but the reason the question asked for is missing.',
  'TST-03': 'This part was left blank or unfinished.',
  'TST-04': 'A middle step was treated as the final answer.',
  'TST-05': 'A good start was stopped or crossed out before reaching an answer.',
  'TST-06': 'A quick check would show this answer cannot be right, like a negative length.',
};

/** Plain-words explanation for an error code. Unknown codes fall back to the code itself. */
export function errorCodeHelp(code: string): string {
  return ERROR_CODE_HELP[currentCode(code)] ?? code;
}

/** Pillar for an error code (CON, STR, PRC, FAC, COM, TST), or undefined when unknown. */
export function errorCodePillar(code: string): PillarCategory | undefined {
  return codePillar(code);
}
