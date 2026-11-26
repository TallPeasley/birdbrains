// Every error code comes from backend/birdbrains/error_codes.json, the one list the
// grading backend uses too, so the site and the backend can never disagree.
// Ids are readable (PRC_SIGN_OR_FACTOR_DROPPED) and stay internal; people see
// `plain_name` and `student_help`, never the id.
import data from '@/backend/birdbrains/error_codes.json';
import type { PillarCategory } from '@/types/birdBrains';

export interface ErrorCodeInfo {
  id: string;
  pillar: PillarCategory;
  /** Staff wording, e.g. "Sign or Factor Dropped". */
  name: string;
  /** What students and parents see, e.g. "Sign or term lost while rearranging". */
  plain_name: string;
  /** One plain sentence for a student. */
  student_help: string;
  description: string;
  example: string;
  tell_apart: { code: string | null; how: string }[];
  remediation: string;
  legacy_ids: string[];
}

export const ERROR_CODES: ErrorCodeInfo[] = (data as { codes: ErrorCodeInfo[] }).codes;

const BY_ID: Record<string, ErrorCodeInfo> = Object.fromEntries(ERROR_CODES.map((c) => [c.id, c]));

/** Old four-pillar ids (CON-01 ...) -> current id. Old ids are never reused. */
export const LEGACY_CODES: Record<string, string> = Object.fromEntries(
  ERROR_CODES.flatMap((c) => c.legacy_ids.map((old) => [old, c.id])),
);

/** The current id for a code (old ids are remapped; others pass through). */
export function currentCode(code: string): string {
  return LEGACY_CODES[code] ?? code;
}

/** Full details for a code (old ids accepted), or undefined when unknown. */
export function errorCodeInfo(code: string): ErrorCodeInfo | undefined {
  return BY_ID[currentCode(code)];
}

/** Staff names by id. Kept for staff tools and search; not shown to students or parents. */
export const ERROR_CODE_NAMES: Record<string, string> = Object.fromEntries(ERROR_CODES.map((c) => [c.id, c.name]));

/** What people see: a short, plain name for each kind of mistake. */
export const MISTAKE_NAMES: Record<string, string> = Object.fromEntries(
  ERROR_CODES.map((c) => [c.id, c.plain_name]),
);

/** Staff name. */
export function errorCodeName(code: string): string | undefined {
  return errorCodeInfo(code)?.name;
}

/** Plain name for a mistake code, e.g. "PRC_SIGN_OR_FACTOR_DROPPED" -> "Sign or term lost while rearranging". */
export function mistakeName(code: string, fallback?: string): string {
  return errorCodeInfo(code)?.plain_name ?? fallback ?? 'Other mistake';
}

const PILLAR_KEYS: PillarCategory[] = ['CON', 'STR', 'PRC', 'FAC', 'COM', 'TST'];

/** Pillar a code belongs to (its first three letters after remapping old ids), or undefined. */
export function codePillar(code: string): PillarCategory | undefined {
  const prefix = currentCode(code).slice(0, 3) as PillarCategory;
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
