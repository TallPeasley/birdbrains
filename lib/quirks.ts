// Quirks and antiquirks, per pillar. Every pillar has 4 checks (24 in all, from
// backend/birdbrains/quirks.json, the same list the grader uses). Of a pillar's
// checks that apply, 2/3+ met = the pillar's quirk, 1/4 or fewer = its antiquirk,
// anything else neutral. Ids stay internal; people see plain names.
import data from '@/backend/birdbrains/quirks.json';
import type { PillarCategory, PillarQuirk, PillarQuirkStatus, PillarTally, Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { PILLAR_ORDER, PILLARS } from '@/lib/pillars';

export interface CheckInfo {
  id: string;
  pillar: PillarCategory;
  /** What people see, e.g. "Checked the answer". */
  plain_name: string;
  /** Shown when met. */
  earned_line: string;
  /** Shown when missed or not yet met. */
  how_to_earn: string;
  description: string;
  opposes: string[];
}

export const CHECKS: CheckInfo[] = (data as { quirks: CheckInfo[] }).quirks;
const BY_ID: Record<string, CheckInfo> = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

export function checkInfo(id: string): CheckInfo | undefined {
  return BY_ID[id];
}

export function checkName(id: string): string {
  return BY_ID[id]?.plain_name ?? 'Check';
}

/** Same rule as backend quirks.pillar_status. */
export function pillarStatus(met: number, tested: number): PillarQuirkStatus {
  if (tested === 0) return 'NOT_SHOWN';
  if (met * 3 >= tested * 2) return 'QUIRK';
  if (met * 4 <= tested) return 'ANTIQUIRK';
  return 'NEUTRAL';
}

/** "Concepts quirk", "Procedure antiquirk" ... */
export function pillarQuirkName(pillar: PillarCategory, status: PillarQuirkStatus): string {
  const p = PILLARS[pillar].short;
  if (status === 'QUIRK') return `${p} quirk`;
  if (status === 'ANTIQUIRK') return `${p} antiquirk`;
  if (status === 'NEUTRAL') return `${p}: on the way`;
  return p;
}

export const STATUS_STYLE: Record<PillarQuirkStatus, { label: string; badge: string; card: string }> = {
  QUIRK: { label: 'Quirk', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200', card: 'border-emerald-200 bg-emerald-50/50' },
  NEUTRAL: { label: 'Neutral', badge: 'bg-slate-100 text-slate-700 ring-slate-200', card: 'border-slate-200 bg-white' },
  ANTIQUIRK: { label: 'Antiquirk', badge: 'bg-rose-100 text-rose-800 ring-rose-200', card: 'border-rose-200 bg-rose-50/40' },
  NOT_SHOWN: { label: 'Not tested', badge: 'bg-slate-50 text-slate-500 ring-slate-200', card: 'border-dashed border-slate-200 bg-white' },
};

/** All six pillars in order, filling any missing pillar as not tested. */
export function allPillars(items: PillarQuirk[] | undefined): PillarQuirk[] {
  const by = new Map((items ?? []).map((p) => [p.pillar, p]));
  return PILLAR_ORDER.map(
    (p) =>
      by.get(p) ?? {
        pillar: p,
        status: 'NOT_SHOWN',
        met: 0,
        tested: 0,
        checks: CHECKS.filter((c) => c.pillar === p).map((c) => ({ checkId: c.id, status: 'NOT_TESTED' as const })),
      },
  );
}

/** Per-pillar tallies from gradings already loaded (sample data, or when the tallies
 *  endpoint fails). Same shape as GET /students/{id}/quirks. */
export function tallyFromGradings(gradings: Pick<Stage2GradingAndAffectOutput, 'gradedAt' | 'pillarQuirks'>[]): PillarTally[] {
  const rows: Record<string, PillarTally> = Object.fromEntries(
    PILLAR_ORDER.map((p) => [
      p,
      {
        pillar: p, quirks: 0, antiquirks: 0, neutral: 0, firstQuirkAt: null, lastStatus: null, lastAt: null,
        checks: CHECKS.filter((c) => c.pillar === p).map((c) => ({ checkId: c.id, met: 0, missed: 0 })),
      },
    ]),
  );
  const sorted = [...gradings].sort((a, b) => (a.gradedAt ?? '').localeCompare(b.gradedAt ?? ''));
  for (const g of sorted) {
    for (const pq of g.pillarQuirks ?? []) {
      const r = rows[pq.pillar];
      if (!r) continue;
      if (pq.status === 'QUIRK') {
        r.quirks += 1;
        r.firstQuirkAt = r.firstQuirkAt ?? g.gradedAt ?? null;
      } else if (pq.status === 'ANTIQUIRK') r.antiquirks += 1;
      else if (pq.status === 'NEUTRAL') r.neutral += 1;
      if (pq.status !== 'NOT_SHOWN') {
        r.lastStatus = pq.status;
        r.lastAt = g.gradedAt ?? null;
      }
      for (const c of pq.checks) {
        const t = r.checks.find((x) => x.checkId === c.checkId);
        if (!t) continue;
        if (c.status === 'MET') t.met += 1;
        else if (c.status === 'MISSED') t.missed += 1;
      }
    }
  }
  return PILLAR_ORDER.map((p) => rows[p]);
}

/** Pillars whose quirk was earned on `gradingId` for the first time. */
export function firstTimeQuirks(
  history: Pick<Stage2GradingAndAffectOutput, 'gradingId' | 'gradedAt' | 'pillarQuirks'>[],
  gradingId: string,
): Set<PillarCategory> {
  const current = history.find((g) => g.gradingId === gradingId);
  if (!current) return new Set();
  const earlier = new Set(
    history
      .filter((g) => g.gradingId !== gradingId && (g.gradedAt ?? '') < (current.gradedAt ?? ''))
      .flatMap((g) => (g.pillarQuirks ?? []).filter((p) => p.status === 'QUIRK').map((p) => p.pillar)),
  );
  return new Set((current.pillarQuirks ?? []).filter((p) => p.status === 'QUIRK' && !earlier.has(p.pillar)).map((p) => p.pillar));
}
