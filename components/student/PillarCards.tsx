import type { PillarBreakdown } from '@/types/birdBrains';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { MathNumber, MathText } from '@/components/MathText';
import PillarBadge from '@/components/PillarBadge';
import SectionIndex from '@/components/aero/SectionIndex';

export default function PillarCards({ pillars }: { pillars: PillarBreakdown[] }) {
  const sorted = [...pillars].sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar));
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2.5 text-base font-bold text-slate-900">
        <SectionIndex n={2} />
        Four-pillar breakdown
      </h2>
      {/* One bordered grid: the four pillars share their 1px edges. */}
      <div className="aero-cells sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((p) => {
          const pct = (p.earnedScore / p.maxScore) * 100;
          const mastered = pct === 100;
          const bar = mastered ? 'bg-emerald-500' : pct >= 70 ? 'bg-brand' : 'bg-rose-500';
          return (
            <article key={p.pillar} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <PillarBadge pillar={p.pillar} />
                {mastered ? (
                  <span className="aero-badge aero-badge--ok">Mastered</span>
                ) : p.errorCount > 0 ? (
                  <span className="aero-badge aero-badge--bad">
                    {p.errorCount} error{p.errorCount > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 font-bold text-slate-900">{PILLARS[p.pillar].short}</h3>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                <MathNumber value={p.earnedScore} />
                <span className="text-base font-medium text-slate-400">
                  {' / '}
                  <MathNumber value={p.maxScore} />
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${PILLARS[p.pillar].label} score`}>
                <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                <MathText text={p.feedback} />
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
