'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Brain, Calculator, Check, MessageSquareText, ShieldCheck, Sigma, Sparkles } from 'lucide-react';
import { useRole, type Role } from '@/lib/roleContext';
import { demoPersonas } from '@/lib/mockData';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { IS_LIVE } from '@/lib/api';
import AccountCard from '@/components/AccountCard';
import { useSession } from '@/lib/session';
import { MathNumber, MathText } from '@/components/MathText';

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
    <div className="space-y-16 py-4 lg:py-10">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
      {/* Left: hero */}
      <section>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
          <MathText text="Ontario MTH1W · MPM2D" />
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          See <span className="text-indigo-600">why</span> a math answer went wrong, not just that it did.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Snap a photo of handwritten work. BirdBrains traces every step, separates slips from real gaps, and builds a
          worksheet that targets exactly what to practise next.
        </p>

        <h2 className="eyebrow mt-10">
          The <MathNumber value={4} />-Pillar Diagnostic Framework
        </h2>
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
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Pillar <MathNumber value={i + 1} />
                    </p>
                    <p className="font-semibold text-slate-900">{PILLARS[p].label}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  <MathText text={PILLARS[p].description} />
                </p>
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
                      <span className="block text-sm text-slate-500">
                        <MathText text={persona.detail} />
                      </span>
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

      {/* Anonymized sample diagnostic preview */}
      <section className="card overflow-hidden p-6 sm:p-8" aria-labelledby="sample-preview-heading">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="space-y-3">
            <p className="eyebrow">Sample Diagnostic (Anonymized)</p>
            <h2 id="sample-preview-heading" className="text-2xl font-bold tracking-tight text-slate-900">
              Carry-forward protection, step by step
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Students never lose marks twice for the same early slip. BirdBrains isolates the exact line where a misconception happened and protects every consistent step after it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-slate-700">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-800 ring-1 ring-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Names blurred before AI review
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                Photos deleted after 90 days
              </span>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-semibold text-slate-500">
              <span>MPM2D · Completing the Square</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">PRC-03</span>
            </div>
            <div className="rounded-xl border border-rose-200 bg-white p-3">
              <p className="text-xs font-semibold text-rose-700">Step 4 · Root Slip</p>
              <p className="math mt-1 text-slate-900">
                <MathText mode="math" text="y = 2(x + 3)^2 - 9 + 5" />
              </p>
              <p className="mt-1 text-xs text-slate-600">
                The <MathText text="-9" /> leaving the bracket wasn&apos;t multiplied by the outer factor of <MathText text="2" />.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold text-emerald-700">Step 5 · Carry-Forward Protected</p>
              <p className="math mt-1 text-slate-900">
                <MathText mode="math" text="y = 2(x + 3)^2 - 4" />
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Consistent with Step 4 (<MathText text="-9 + 5 = -4" />), so full marks are kept here.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Pro launch summary */}
      <section className="space-y-5" aria-labelledby="home-plans-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Simple plans for families &amp; tutors</p>
            <h2 id="home-plans-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Start Free, upgrade when you need more
            </h2>
          </div>
          <Link href="/plans" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            Compare all features <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900">Free</h3>
            <p className="mt-1 text-sm text-slate-600">10 uploads per student each month with full 4-pillar diagnostics.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" aria-hidden /> Step-by-step error localization</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" aria-hidden /> Mastery chart &amp; EQAO level forecast</li>
            </ul>
          </div>
          <div className="card border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Pro</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                <Sparkles className="h-3 w-3" aria-hidden /> Families &amp; Teachers
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">Unlimited uploads, mood &amp; friction insights, and nightly 3-stage worksheets.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-600" aria-hidden /> Printable 3-stage remedial worksheets</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-600" aria-hidden /> Google Classroom import for teachers</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
