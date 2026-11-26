import { ERROR_CODES, codePillar, errorCodeInfo } from '@/lib/errorCodes';
import type { PillarCategory } from '@/types/birdBrains';

/** Plain-words explanation for each error code, written for a Grade 9–10 student. */
export const ERROR_CODE_HELP: Record<string, string> = Object.fromEntries(
  ERROR_CODES.map((c) => [c.id, c.student_help]),
);

/** Plain-words explanation for an error code (old ids accepted). Unknown codes fall back to a generic line. */
export function errorCodeHelp(code: string): string {
  return errorCodeInfo(code)?.student_help ?? 'A mistake was found on this line.';
}

/** Pillar for an error code (CON, STR, PRC, FAC, COM, TST), or undefined when unknown. */
export function errorCodePillar(code: string): PillarCategory | undefined {
  return codePillar(code);
}
