'use client';

// Quirks and antiquirks: every pillar has 4 checks. Of the checks that apply, 2/3+ met
// earns the pillar's quirk, 1/4 or fewer gives its antiquirk. All six pillars are always
// shown. Ids never show: people see plain names.
import { Check, Minus, Sparkles, Star, X } from 'lucide-react';
import type { CheckStatus, PillarCategory, PillarQuirk, PillarTally } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { STATUS_STYLE, allPillars, checkInfo, checkName, pillarQuirkName } from '@/lib/quirks';
import { MathText } from '@/components/MathText';

const CHECK_ICON: Record<CheckStatus, { icon: typeof Check; cls: string; label: string }> = {
  MET: { icon: Check, cls: 'bg-emerald-100 text-emerald-700', label: 'Met' },
  MISSED: { icon: X, cls: 'bg-rose-100 text-rose-700', label: 'Missed' },
  NOT_TESTED: { icon: Minus, cls: 'bg-slate-100 text-slate-400', label: 'Did not come up' },
};

/** All six pillars for one upload (or one question): status, checks met, and the 4 checks. */
export function PillarQuirks({
  pillars,
  heading = 'Quirks and antiquirks',
  newPillars,
  own = true,
}: {
  pillars: PillarQuirk[] | undefined;
  heading?: string;
  /** Pillars whose quirk was earned for the first time here get a "New!" tag. */
  newPillars?: Set<PillarCategory>;
  own?: boolean;
}) {
  if (!pillars || pillars.length === 0) return null;
  const all = allPillars(pillars);
  const quirks = all.filter((p) => p.status === 'QUIRK').length;
  const antiquirks = all.filter((p) => p.status === 'ANTIQUIRK').length;
  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden /> {heading}
          </h2>
          <p className="text-sm text-slate-500">
            Each pillar has 4 checks. Meet most of the ones that came up to earn its quirk; miss most and it’s an
            antiquirk.
          </p>
        </div>
        <p className="text-sm font-semibold">
          <span className="text-emerald-700">
            {quirks} quirk{quirks === 1 ? '' : 's'}
          </span>
          <span className="text-slate-400"> · </span>
          <span className="text-rose-700">
            {antiquirks} antiquirk{antiquirks === 1 ? '' : 's'}
          </span>
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {all.map((p) => (
          <PillarCard key={p.pillar} p={p} isNew={newPillars?.has(p.pillar)} own={own} />
        ))}
      </div>
    </section>
  );
}

function PillarCard({ p, isNew, own }: { p: PillarQuirk; isNew?: boolean; own: boolean }) {
  const style = STATUS_STYLE[p.status];
  const pillar = PILLARS[p.pillar];
  return (
    <article className={`min-w-0 rounded-xl border p-3.5 ${style.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold" style={{ color: pillar.color }}>
          {pillar.short}
        </h3>
        <span className="flex items-center gap-1.5">
          {isNew && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 ring-1 ring-amber-200">
              New!
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style.badge}`}>
            {p.status === 'QUIRK' && <Star className="h-3 w-3 fill-emerald-500 text-emerald-600" aria-hidden />}
            {style.label}
          </span>
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {p.tested === 0 ? 'None of these checks came up.' : `${p.met} of ${p.tested} checks met`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {p.checks.map((c) => {
          const meta = CHECK_ICON[c.status];
          const Icon = meta.icon;
          const info = checkInfo(c.checkId);
          const line =
            c.status === 'MET'
              ? c.evidence || info?.earned_line
              : c.status === 'MISSED'
                ? c.evidence || info?.how_to_earn
                : undefined;
          return (
            <li key={c.checkId} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                <Icon className="h-3 w-3" aria-label={meta.label} />
              </span>
              <div className="min-w-0">
                <p className={c.status === 'NOT_TESTED' ? 'text-slate-400' : 'font-medium text-slate-800'}>
                  {checkName(c.checkId)}
                  {c.questionLabel && <span className="ml-1 text-[11px] font-normal text-slate-500">· Q{c.questionLabel}</span>}
                </p>
                {line && (
                  <p className="break-words text-xs text-slate-600">
                    <MathText text={own ? line : line.replace(/^You /, 'They ')} />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** A compact row: one chip per pillar that came up (quirk, neutral or antiquirk). */
export function PillarQuirkChips({ pillars, className = '' }: { pillars: PillarQuirk[] | undefined; className?: string }) {
  const shown = allPillars(pillars).filter((p) => p.status !== 'NOT_SHOWN');
  if (!pillars || pillars.length === 0 || shown.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((p) => (
        <li
          key={p.pillar}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[p.status].badge}`}
          title={`${p.met} of ${p.tested} checks met`}
        >
          {p.status === 'QUIRK' && <Star className="h-2.5 w-2.5 fill-emerald-500 text-emerald-600" aria-hidden />}
          {pillarQuirkName(p.pillar, p.status)}
        </li>
      ))}
    </ul>
  );
}

/** Quirks and antiquirks per pillar over every upload, with each check's met/missed count. */
export function QuirkTracker({ rows, own = true }: { rows: PillarTally[]; own?: boolean }) {
  const totalQ = rows.reduce((n, r) => n + r.quirks, 0);
  const totalA = rows.reduce((n, r) => n + r.antiquirks, 0);
  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{own ? 'Your quirk tracker' : 'Quirk tracker'}</h2>
          <p className="text-sm text-slate-500">Quirks and antiquirks earned in each pillar, across every upload.</p>
        </div>
        <p className="text-sm font-semibold">
          <span className="text-emerald-700">{totalQ} quirks</span>
          <span className="text-slate-400"> · </span>
          <span className="text-rose-700">{totalA} antiquirks</span>
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const pillar = PILLARS[r.pillar];
          const total = r.quirks + r.antiquirks + r.neutral;
          return (
            <article key={r.pillar} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold" style={{ color: pillar.color }}>
                  {pillar.short}
                </h3>
                {r.lastStatus && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[r.lastStatus].badge}`}>
                    Last: {STATUS_STYLE[r.lastStatus].label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm">
                <span className="font-semibold text-emerald-700">★ {r.quirks}</span>
                <span className="text-slate-500"> quirk{r.quirks === 1 ? '' : 's'} · </span>
                <span className="font-semibold text-rose-700">{r.antiquirks}</span>
                <span className="text-slate-500"> antiquirk{r.antiquirks === 1 ? '' : 's'}</span>
              </p>
              {total > 0 && (
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="bg-emerald-500" style={{ width: `${(100 * r.quirks) / total}%` }} />
                  <div className="bg-slate-300" style={{ width: `${(100 * r.neutral) / total}%` }} />
                  <div className="bg-rose-500" style={{ width: `${(100 * r.antiquirks) / total}%` }} />
                </div>
              )}
              <ul className="mt-3 space-y-1">
                {r.checks.map((c) => (
                  <li key={c.checkId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700">{checkName(c.checkId)}</span>
                    <span className="shrink-0 text-slate-500">
                      <span className="text-emerald-700">{c.met}✓</span> <span className="text-rose-700">{c.missed}✗</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** A parent's or teacher's short view: quirks and antiquirks per pillar so far. */
export function PillarTallySummary({ rows, name }: { rows: PillarTally[]; name?: string }) {
  const any = rows.some((r) => r.quirks + r.antiquirks + r.neutral > 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden /> {name ? `${name}’s quirks and antiquirks` : 'Quirks and antiquirks'}
      </h3>
      {!any ? (
        <p className="mt-2 text-sm text-slate-600">None yet. They show up as uploads are checked.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.pillar} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: PILLARS[r.pillar].color }} aria-hidden />
                <span className="text-slate-800">{PILLARS[r.pillar].short}</span>
              </span>
              <span className="shrink-0 text-xs">
                <span className="font-semibold text-emerald-700">★ {r.quirks} quirk{r.quirks === 1 ? '' : 's'}</span>
                <span className="text-slate-400"> · </span>
                <span className="font-semibold text-rose-700">
                  {r.antiquirks} antiquirk{r.antiquirks === 1 ? '' : 's'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
