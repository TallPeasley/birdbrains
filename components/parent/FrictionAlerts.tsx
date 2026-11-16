import { AlertTriangle, MessageCircleHeart } from 'lucide-react';
import type { ParentProjectionSummary } from '@/types/birdBrains';
import { AFFECT_META } from '@/lib/pillars';
import { MathText } from '@/components/MathText';

export default function FrictionAlerts({ alerts }: { alerts: ParentProjectionSummary['cognitiveFrictionAlerts'] }) {
  return (
    <section className="card min-w-0 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Frustration & anxiety signals</h2>
      <p className="text-sm text-slate-500">Moments where the work got hard, with something you can try at home.</p>
      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No friction detected recently.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.map((a, i) => {
            const meta = AFFECT_META[a.frictionLevel];
            const formattedDate = new Date(`${a.detectedDate}T00:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <li key={i} className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden />
                  <span className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.badge}`}>{meta.label}</span>
                  <span className="text-sm font-medium text-slate-800">
                    <MathText text={a.topicContext} />
                  </span>
                  <time className="ml-auto text-xs text-slate-500" dateTime={a.detectedDate}>
                    <MathText text={formattedDate} />
                  </time>
                </div>
                <div className="mt-3 flex gap-3 rounded-md bg-white p-3 ring-1 ring-line">
                  <MessageCircleHeart className="h-5 w-5 shrink-0 text-brand-3" aria-hidden />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-3">Try this at home</p>
                    <p className="mt-1 text-sm text-slate-700">
                      <MathText text={a.actionableParentInsight} />
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
