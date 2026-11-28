import type { ParentProjectionSummary } from '@/types/birdBrains';
import { eqaoDistribution } from '@/lib/projections';
import { eqaoLabel } from '@/lib/pillars';
import { MathNumber, MathText } from '@/components/MathText';
import { isOntarioCourse } from '@/lib/curricula';
import type { EQAOLevel } from '@/types/birdBrains';

const LEVEL_DESC = ['Limited', 'Approaching standard', 'Provincial standard', 'Exceeds standard'];
// Outside Ontario the same four bands are shown as plain score ranges (the backend's
// level floors are 60%, 70% and 80%), since achievement levels are Ontario's scale.
const SCORE_BANDS = ['Below 60%', '60 to 69%', '70 to 79%', '80% and up'];

/** Ontario students see the EQAO-style achievement level; everyone else sees score bands. */
export default function EqaoForecast({ summary }: { summary: ParentProjectionSummary }) {
  const ontario = isOntarioCourse(summary.course);
  const levelName = (level: EQAOLevel) =>
    ontario ? eqaoLabel(level) : SCORE_BANDS[Number(level.split('_')[1]) - 1];
  const dist = eqaoDistribution(summary.overallEqaoForecast, summary.eqaoForecastConfidence);
  return (
    <section className="card min-w-0 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{ontario ? 'EQAO achievement forecast' : 'Achievement forecast'}</h2>
      <p className="text-sm text-slate-500">
        {ontario ? 'Likely level, based on diagnostic history.' : 'Likely score range, based on diagnostic history.'}
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">
          <MathText text={levelName(summary.overallEqaoForecast)} />
        </span>
        <span className="text-sm font-medium text-slate-500">
          <MathNumber value={summary.eqaoForecastConfidence} suffix="%" /> likely
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {[...dist].reverse().map((d) => {
          const isForecast = d.level === summary.overallEqaoForecast;
          const idx = Number(d.level.split('_')[1]) - 1;
          return (
            <li key={d.level}>
              <div className="flex items-center justify-between text-sm">
                <span className={isForecast ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                  <MathText text={levelName(d.level)} />
                  {ontario && <span className="text-xs text-slate-400"> · {LEVEL_DESC[idx]}</span>}
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
    </section>
  );
}
