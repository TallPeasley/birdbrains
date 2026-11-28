import type { EQAOLevel, ParentProjectionSummary } from '@/types/birdBrains';
import { eqaoDistribution } from '@/lib/projections';
import { MathNumber, MathText } from '@/components/MathText';
import { FORECAST_NOTE, forecastScale, isOntarioCourse } from '@/lib/curricula';

/**
 * The achievement forecast, named in the student's own curriculum: EQAO levels in
 * Ontario, the BC proficiency scale, Alberta's provincial standards, Quebec marks, US
 * state test levels, KS2 standards and GCSE / A level grades in England, IB grades, AP
 * scores, or plain score ranges. The backend's four bands (below 60%, 60-69, 70-79,
 * 80+) are the same everywhere; only the names change (see curricula.json).
 */
export default function EqaoForecast({ summary }: { summary: ParentProjectionSummary }) {
  const scale = forecastScale(summary.course);
  const ontario = isOntarioCourse(summary.course);
  const idxOf = (level: EQAOLevel) => Number(level.split('_')[1]) - 1;
  const dist = eqaoDistribution(summary.overallEqaoForecast, summary.eqaoForecastConfidence);
  return (
    <section className="card min-w-0 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {ontario ? 'EQAO achievement forecast' : `Achievement forecast · ${scale.name}`}
      </h2>
      <p className="text-sm text-slate-500">Likely result, based on diagnostic history.</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 sm:text-4xl">
          <MathText text={scale.labels[idxOf(summary.overallEqaoForecast)]} />
        </span>
        <span className="text-sm font-medium text-slate-500">
          <MathNumber value={summary.eqaoForecastConfidence} suffix="%" /> likely
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {[...dist].reverse().map((d) => {
          const isForecast = d.level === summary.overallEqaoForecast;
          const idx = idxOf(d.level);
          return (
            <li key={d.level}>
              <div className="flex items-center justify-between text-sm">
                <span className={isForecast ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                  <MathText text={scale.labels[idx]} />
                  {scale.descriptions && <span className="text-xs text-slate-400"> · {scale.descriptions[idx]}</span>}
                </span>
                <MathNumber value={d.probability} suffix="%" className="text-slate-500" />
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${isForecast ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  style={{ width: `${d.probability}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {!ontario && (
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {scale.note} {FORECAST_NOTE.replace(' Needs review.', '')}
        </p>
      )}
    </section>
  );
}
