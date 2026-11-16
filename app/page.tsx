'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useRole, type Role } from '@/lib/roleContext';
import { demoPersonas } from '@/lib/mockData';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { IS_LIVE } from '@/lib/api';
import AccountCard from '@/components/AccountCard';
import AeroLogo from '@/components/aero/AeroLogo';
import SectionIndex from '@/components/aero/SectionIndex';
import PillarBadge from '@/components/PillarBadge';
import { useSession } from '@/lib/session';
import { MathText } from '@/components/MathText';

/** Telemetry strip under the hero. Each figure is a fact about the product, not a metric. */
const SPECS: [figure: string, label: string][] = [
  ['04', 'Pillars in every diagnostic'],
  ['16', 'Official error codes'],
  ['03', 'Stages in each worksheet'],
];

export default function HomePage() {
  const { role, setRole } = useRole();
  const router = useRouter();
  const { setDemo } = useSession();

  const signIn = (r: Role) => {
    if (IS_LIVE) setDemo(true);
    setRole(r, false);
    router.push(`/${r}`);
  };

  return (
    <div className="grid gap-8 py-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10 lg:py-8">
      {/* Left: hero */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <span className="aero-badge aero-badge--accent">Ontario · MTH1W · MPM2D</span>
          <span className="aero-coord">GR 9–10 MATH</span>
        </div>
        <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] text-slate-900 sm:text-[3.25rem]">
          See <em className="font-serif font-normal tracking-normal text-brand">why</em> a math answer went wrong, not just
          that it did.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600">
          Snap a photo of handwritten work. BirdBrains traces every step, separates slips from real gaps, and builds a
          worksheet that targets exactly what to practise next.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-[148px_minmax(0,1fr)]">
          <figure className="aero-plate aero-blueprint m-0 max-sm:w-36">
            <AeroLogo brand="birdbrains" variant="isometric" title="BirdBrains cortex cube" />
            <figcaption className="contents">
              <span className="aero-plate__tag aero-plate__tag--tl">Fig. 01</span>
              <span className="aero-plate__tag aero-plate__tag--br">Iso 30°</span>
            </figcaption>
          </figure>
          <dl className="aero-cells m-0 grid-cols-3">
            {SPECS.map(([figure, label]) => (
              <div key={label} className="flex flex-col justify-between gap-3 p-3 sm:p-4">
                <dd className="m-0 font-mono text-3xl font-semibold tracking-tight text-slate-900">{figure}</dd>
                <dt className="text-xs leading-snug text-slate-500">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <h2 className="mt-10 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-base font-bold text-slate-900">
          <SectionIndex n={1} />
          The 4-Pillar Diagnostic Framework
        </h2>
        <div className="aero-cells mt-3 sm:grid-cols-2">
          {PILLAR_ORDER.map((p, i) => (
            <div key={p} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <PillarBadge pillar={p} />
                <span className="aero-coord">PILLAR {String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-3 font-display font-bold tracking-display text-slate-900">{PILLARS[p].label}</p>
              <p className="mt-1 text-sm text-slate-600">
                <MathText text={PILLARS[p].description} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Right: quick auth */}
      <section className="lg:pt-2">
        {IS_LIVE && <AccountCard />}
        <div className={`card p-6 ${IS_LIVE ? 'mt-6' : ''}`}>
          <h2 className="flex items-baseline gap-2.5 text-lg font-bold text-slate-900">
            <SectionIndex n={2} />
            {IS_LIVE ? 'Try the demo' : 'Sign in'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {IS_LIVE
              ? 'No account needed. Explore as a sample student or parent; nothing is saved.'
              : 'Choose a demo persona to explore with sample data.'}
          </p>

          <div className="mt-5 space-y-3">
            {(['student', 'parent'] as Role[]).map((r) => {
              const persona = demoPersonas[r];
              const selected = role === r;
              return (
                <div
                  key={r}
                  className={`rounded-lg border p-4 transition-colors ${
                    selected ? 'border-brand bg-brand-soft' : 'border-line'
                  }`}
                >
                  <button
                    onClick={() => setRole(r, false)}
                    aria-pressed={selected}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border font-mono text-sm font-semibold ${
                        selected ? 'border-brand-line bg-white text-brand-3' : 'border-line bg-canvas text-slate-600'
                      }`}
                    >
                      {persona.initials}
                    </span>
                    <span className="flex-1">
                      <span className="eyebrow block">{r === 'student' ? 'Student' : 'Parent'}</span>
                      <span className="mt-0.5 block font-semibold text-slate-900">{persona.name}</span>
                      <span className="block text-sm text-slate-500">
                        <MathText text={persona.detail} />
                      </span>
                    </span>
                  </button>
                  {selected && (
                    <button
                      onClick={() => signIn(r)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
                    >
                      Continue as {persona.name.split(' ')[0]}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
