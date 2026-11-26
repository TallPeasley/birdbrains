// Quirks are strengths; antiquirks are mistakes (the error codes in lib/errorCodes.ts).
// Every quirk comes from backend/birdbrains/quirks.json, the same list the grader uses.
// Ids (QK_TST_CHECKED_ANSWER) stay internal; people see the plain name and lines.
import data from '@/backend/birdbrains/quirks.json';
import type { EarnedQuirk, PillarCategory, QuirkCount } from '@/types/birdBrains';

export interface QuirkInfo {
  id: string;
  pillar: PillarCategory;
  /** What people see, e.g. "Checked the answer". */
  plain_name: string;
  /** Shown when earned: "You checked your answer by ...". */
  earned_line: string;
  /** Shown on a slot not yet earned. */
  how_to_earn: string;
  description: string;
  opposes: string[];
}

export const QUIRKS: QuirkInfo[] = (data as { quirks: QuirkInfo[] }).quirks;

const BY_ID: Record<string, QuirkInfo> = Object.fromEntries(QUIRKS.map((q) => [q.id, q]));

export function quirkInfo(id: string): QuirkInfo | undefined {
  return BY_ID[id];
}

export function quirkName(id: string): string {
  return BY_ID[id]?.plain_name ?? 'Strength';
}

/** Known quirks only, one per kind, in first-seen order. */
export function uniqueQuirks(items: EarnedQuirk[] | undefined): EarnedQuirk[] {
  const seen = new Set<string>();
  return (items ?? []).filter((q) => {
    if (!BY_ID[q.quirkId] || seen.has(q.quirkId)) return false;
    seen.add(q.quirkId);
    return true;
  });
}

/** Earned quirks, most earned first (ties: most recent first). */
export function topQuirks(rows: QuirkCount[], n = 3): QuirkCount[] {
  return rows
    .filter((r) => r.count > 0 && BY_ID[r.quirkId])
    .sort((a, b) => b.count - a.count || (b.lastEarnedAt ?? '').localeCompare(a.lastEarnedAt ?? ''))
    .slice(0, n);
}

/** Collection counts worked out from gradings already loaded (sample data, or when the
 *  collection endpoint is unavailable). A quirk counts once per upload. */
export function countQuirks(gradings: { gradedAt?: string; quirks?: EarnedQuirk[] }[]): QuirkCount[] {
  const rows: Record<string, QuirkCount> = Object.fromEntries(
    QUIRKS.map((q) => [q.id, { quirkId: q.id, pillar: q.pillar, count: 0, firstEarnedAt: null, lastEarnedAt: null }]),
  );
  for (const g of gradings) {
    for (const q of uniqueQuirks(g.quirks)) {
      const r = rows[q.quirkId];
      r.count += 1;
      const at = g.gradedAt ?? null;
      if (at && (!r.firstEarnedAt || at < r.firstEarnedAt)) r.firstEarnedAt = at;
      if (at && (!r.lastEarnedAt || at > r.lastEarnedAt)) r.lastEarnedAt = at;
    }
  }
  return QUIRKS.map((q) => rows[q.id]);
}
