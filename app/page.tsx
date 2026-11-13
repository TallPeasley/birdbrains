'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Brain, Calculator, Sigma, MessageSquareText } from 'lucide-react';
import { useRole, type Role } from '@/lib/roleContext';
import { demoPersonas } from '@/lib/mockData';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { IS_LIVE } from '@/lib/api';
import AccountCard from '@/components/AccountCard';
import { useSession } from '@/lib/session';

const PILLAR_ICONS = {
  CON: Brain,
  PRC: Calculator,
  FAC: Sigma,
  TST: MessageSquareText,
} as const;

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
    <div className="grid gap-8 py-4 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-10">
      {/* Left: hero */}
      <section>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
          Ontario MTH1W · MPM2D
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          See <span className="text-indigo-600">why</span> a math answer went wrong, not just that it did.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Snap a photo of handwritten work. BirdBrains traces every step, separates slips from real gaps, and builds a
          worksheet that targets exactly what to practise next.
        </p>

        <h2 className="eyebrow mt-10">The 4-Pillar Diagnostic Framework</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PILLAR_ORDER.map((p, i) => {
            const Icon = PILLAR_ICONS[p];
            return (
              <div key={p} className="card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl text-white"
                    style={{ backgroundColor: PILLARS[p].color }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pillar {i + 1}</p>
                    <p className="font-semibold text-slate-900">{PILLARS[p].label}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{PILLARS[p].description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Right: quick auth */}
      <section className="lg:pt-8">
        {IS_LIVE && <AccountCard />}
        <div className={`card p-6 ${IS_LIVE ? 'mt-6' : ''}`}>
          <h2 className="text-lg font-semibold text-slate-900">{IS_LIVE ? 'Try the demo' : 'Sign in'}</h2>
          <p className="text-sm text-slate-500">
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
                  className={`rounded-2xl border p-4 transition ${
                    selected ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200'
                  }`}
                >
                  <button onClick={() => setRole(r, false)} className="flex w-full items-center gap-3 text-left">
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${
                        r === 'student' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      {persona.initials}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {r === 'student' ? 'Student' : 'Parent'}
                      </span>
                      <span className="block font-semibold text-slate-900">{persona.name}</span>
                      <span className="block text-sm text-slate-500">{persona.detail}</span>
                    </span>
                  </button>
                  {selected && (
                    <button
                      onClick={() => signIn(r)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
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
