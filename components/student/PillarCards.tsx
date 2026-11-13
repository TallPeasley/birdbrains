import type { PillarBreakdown } from '@/types/birdBrains';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';

export default function PillarCards({ pillars }: { pillars: PillarBreakdown[] }) {
  const sorted = [...pillars].sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar));
  return (
    <section>
      <h2 className="eyebrow mb-3">Four-pillar breakdown</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((p) => {
          const pct = (p.earnedScore / p.maxScore) * 100;
          const mastered = pct === 100;
          const bar = mastered ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : 'bg-rose-500';
          return (
            <article key={p.pillar} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{PILLARS[p.pillar].short}</h3>
                {mastered ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Mastered
                  </span>
                ) : p.errorCount > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                    {p.errorCount} error{p.errorCount > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {p.earnedScore}
                <span className="text-base font-medium text-slate-400"> / {p.maxScore}</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${PILLARS[p.pillar].label} score`}>
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{p.feedback}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
