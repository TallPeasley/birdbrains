import type { ParentProjectionSummary } from '@/types/birdBrains';
import { eqaoDistribution } from '@/lib/projections';
import { eqaoLabel } from '@/lib/pillars';

const LEVEL_DESC = ['Limited', 'Approaching standard', 'Provincial standard', 'Exceeds standard'];

export default function EqaoForecast({ summary }: { summary: ParentProjectionSummary }) {
  const dist = eqaoDistribution(summary.overallEqaoForecast, summary.eqaoForecastConfidence);
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900">EQAO achievement forecast</h2>
      <p className="text-sm text-slate-500">Likely level, based on diagnostic history.</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">{eqaoLabel(summary.overallEqaoForecast)}</span>
        <span className="text-sm font-medium text-slate-500">{summary.eqaoForecastConfidence}% likely</span>
      </div>

      <ul className="mt-5 space-y-3">
        {[...dist].reverse().map((d) => {
          const isForecast = d.level === summary.overallEqaoForecast;
          const idx = Number(d.level.split('_')[1]) - 1;
          return (
            <li key={d.level}>
              <div className="flex items-center justify-between text-sm">
                <span className={isForecast ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                  {eqaoLabel(d.level)} <span className="text-xs text-slate-400">· {LEVEL_DESC[idx]}</span>
                </span>
                <span className="tabular-nums text-slate-500">{d.probability}%</span>
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
