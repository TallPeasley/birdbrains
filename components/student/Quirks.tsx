'use client';

// Quirks are strengths the grader spotted; antiquirks are mistakes to fix.
// Ids never show: people see the plain name, the evidence line and how to earn one.
import { Lock, Sparkles, Star } from 'lucide-react';
import type { EarnedQuirk, QuirkCount } from '@/types/birdBrains';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { QUIRKS, quirkInfo, quirkName, topQuirks, uniqueQuirks } from '@/lib/quirks';
import { MathText } from '@/components/MathText';

/** The green "Quirks you earned" strip for one upload or one question. */
export function QuirksEarned({
  quirks,
  heading = 'Quirks you earned',
  newIds,
  compact = false,
}: {
  quirks: EarnedQuirk[] | undefined;
  heading?: string;
  /** Quirks earned for the first time on this upload get a "New!" tag. */
  newIds?: Set<string>;
  compact?: boolean;
}) {
  const list = uniqueQuirks(quirks);
  if (list.length === 0) return null;
  return (
    <div className={`rounded-xl border border-emerald-200 bg-emerald-50/60 ${compact ? 'p-3' : 'mt-4 p-3.5'}`}>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> {heading}
      </h3>
      <ul className={`mt-2 ${compact ? 'flex flex-wrap gap-2' : 'space-y-2'}`}>
        {list.map((q) => {
          const info = quirkInfo(q.quirkId);
          const pillar = PILLARS[q.pillar];
          const isNew = newIds?.has(q.quirkId);
          if (compact) {
            return (
              <li
                key={q.quirkId}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200"
                title={q.evidence || info?.earned_line}
              >
                <Star className="h-3 w-3 text-emerald-600" aria-hidden />
                {quirkName(q.quirkId)}
                {isNew && <NewTag />}
              </li>
            );
          }
          return (
            <li
              key={q.quirkId}
              className="min-w-0 rounded-xl border border-emerald-200 border-l-4 bg-white p-3"
              style={{ borderLeftColor: pillar?.color ?? '#10b981' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Star className="h-4 w-4 text-emerald-600" aria-hidden />
                <p className="text-sm font-semibold text-slate-900">{quirkName(q.quirkId)}</p>
                {isNew && <NewTag />}
                {pillar && (
                  <span className="text-[11px] font-medium" style={{ color: pillar.color }}>
                    {pillar.short}
                  </span>
                )}
                {q.questionLabel && <span className="text-[11px] text-slate-500">· Question {q.questionLabel}</span>}
              </div>
              <p className="mt-1 break-words text-sm text-slate-600">
                <MathText text={q.evidence || info?.earned_line || ''} />
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewTag() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 ring-1 ring-amber-200">
      New!
    </span>
  );
}

/** Quirks earned on the upload `gradingId` that no earlier upload earned. */
export function firstTimeQuirks(
  history: { gradingId: string; gradedAt?: string; quirks?: EarnedQuirk[] }[],
  gradingId: string,
): Set<string> {
  const current = history.find((g) => g.gradingId === gradingId);
  if (!current) return new Set();
  const earlier = new Set(
    history
      .filter((g) => g.gradingId !== gradingId && (g.gradedAt ?? '') < (current.gradedAt ?? ''))
      .flatMap((g) => uniqueQuirks(g.quirks).map((q) => q.quirkId)),
  );
  return new Set(uniqueQuirks(current.quirks).map((q) => q.quirkId).filter((id) => !earlier.has(id)));
}

/** Every quirk, grouped by pillar: earned ones lit with their count, the rest show how to earn them. */
export function QuirkCollection({ rows, own = true }: { rows: QuirkCount[]; own?: boolean }) {
  const byId = new Map(rows.map((r) => [r.quirkId, r]));
  const earned = rows.filter((r) => r.count > 0).length;
  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{own ? 'Your quirk collection' : 'Quirk collection'}</h2>
          <p className="text-sm text-slate-500">
            Quirks are things {own ? 'you do' : 'they do'} well. Antiquirks are mistakes to fix.
          </p>
        </div>
        <p className="text-sm font-semibold text-emerald-700">
          {earned} of {QUIRKS.length} earned
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PILLAR_ORDER.map((p) => (
          <div key={p}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: PILLARS[p].color }}>
              {PILLARS[p].short}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {QUIRKS.filter((q) => q.pillar === p).map((q) => {
                const row = byId.get(q.id);
                const count = row?.count ?? 0;
                return (
                  <li
                    key={q.id}
                    className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 ${
                      count > 0 ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 ring-slate-200'
                    }`}
                    title={count > 0 ? q.earned_line : q.how_to_earn}
                  >
                    {count > 0 ? (
                      <Star className="mt-0.5 h-4 w-4 shrink-0 fill-emerald-500 text-emerald-600" aria-hidden />
                    ) : (
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${count > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                        {q.plain_name}
                        {count > 1 && <span className="ml-1 text-xs font-semibold text-emerald-700">×{count}</span>}
                      </p>
                      {count === 0 && <p className="text-xs text-slate-500">{q.how_to_earn}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A parent's or teacher's short view: the top strengths so far. */
export function TopStrengths({ rows, name }: { rows: QuirkCount[]; name?: string }) {
  const top = topQuirks(rows, 3);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
        <Sparkles className="h-4 w-4" aria-hidden /> {name ? `${name}’s top strengths` : 'Top strengths'}
      </h3>
      {top.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No quirks earned yet. They show up as uploads are checked.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {top.map((r) => (
            <li key={r.quirkId} className="flex flex-wrap items-baseline gap-2 text-sm">
              <Star className="h-3.5 w-3.5 self-center fill-emerald-500 text-emerald-600" aria-hidden />
              <span className="font-semibold text-slate-900">{quirkName(r.quirkId)}</span>
              <span className="text-xs text-slate-500">
                {r.count} upload{r.count === 1 ? '' : 's'} · {PILLARS[r.pillar].short}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
