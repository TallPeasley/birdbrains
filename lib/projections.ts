import type { EQAOLevel, StrandMastery } from '@/types/birdBrains';
import { EQAO_LEVELS } from './pillars';

/**
 * Projects each strand forward by extending an EWMA-smoothed weekly trend.
 * The payload only carries history, so the projection is computed client-side.
 */
export function projectStrand(strand: StrandMastery, weeksAhead = 2, alpha = 0.5) {
  const pts = strand.historicalTrajectory;
  let trend = 0;
  for (let i = 1; i < pts.length; i++) {
    const delta = pts[i].score - pts[i - 1].score;
    trend = i === 1 ? delta : alpha * delta + (1 - alpha) * trend;
  }
  const last = pts[pts.length - 1]?.score ?? 0;
  return Array.from({ length: weeksAhead }, (_, i) => Math.min(100, Math.round((last + trend * (i + 1)) * 10) / 10));
}

export function buildTrajectoryRows(strands: StrandMastery[], weeksAhead = 2) {
  const weeks = strands[0]?.historicalTrajectory.map((p) => p.weekLabel) ?? [];
  const rows: Record<string, string | number | null>[] = weeks.map((w, i) => {
    const row: Record<string, string | number | null> = { week: w };
    strands.forEach((s) => {
      row[s.strandName] = s.historicalTrajectory[i]?.score ?? null;
      // Join the projected line to the last real point so the dashes start there.
      row[`${s.strandName}__proj`] = i === weeks.length - 1 ? (s.historicalTrajectory[i]?.score ?? null) : null;
    });
    return row;
  });
  const lastNum = weeks.length;
  const projections = strands.map((s) => projectStrand(s, weeksAhead));
  for (let k = 0; k < weeksAhead; k++) {
    const row: Record<string, string | number | null> = { week: `Wk ${lastNum + k + 1}` };
    strands.forEach((s, j) => {
      row[s.strandName] = null;
      row[`${s.strandName}__proj`] = projections[j][k];
    });
    rows.push(row);
  }
  return rows;
}

/**
 * The payload gives a single forecast level plus a confidence. Spread the remaining
 * probability over the other levels, weighted by distance, for the Level 1–4 view.
 */
export function eqaoDistribution(forecast: EQAOLevel, confidence: number) {
  const idx = EQAO_LEVELS.indexOf(forecast);
  const remainder = Math.max(0, 100 - confidence);
  const weightFor = (d: number): number => (d === 1 ? 3 : d === 2 ? 1 : 0.3);
  const others = EQAO_LEVELS.map((_, i) => (i === idx ? 0 : weightFor(Math.abs(i - idx))));
  const total = others.reduce((a, b) => a + b, 0);
  return EQAO_LEVELS.map((level, i) => ({
    level,
    probability: i === idx ? confidence : Math.round(((others[i] / total) * remainder) * 10) / 10,
  }));
}
