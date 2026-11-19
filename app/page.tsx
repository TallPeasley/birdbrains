'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  Lock,
  School,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import { IS_LIVE } from '@/lib/api';
import AccountCard from '@/components/AccountCard';
import PillarBadge from '@/components/PillarBadge';
import SectionIndex from '@/components/aero/SectionIndex';
import { useSession } from '@/lib/session';
import { MathText } from '@/components/MathText';

/** Telemetry strip under the hero. Each figure is a fact about the product, not a metric. */
const SPECS: [figure: string, label: string][] = [
  ['04', 'Pillars in every diagnostic'],
  ['16', 'Official error codes'],
  ['03', 'Stages in each practice worksheet'],
];

const STEPS = [
  {
    icon: Camera,
    title: 'Snap a photo',
    body: 'Take a picture of a test, quiz or homework page, handwriting and all. BirdBrains checks the photo is sharp before it goes anywhere.',
  },
  {
    icon: ScanSearch,
    title: 'See every step diagnosed',
    body: 'Each line of working is read and checked. Mistakes are sorted into the four pillars, so a careless slip never looks like a real gap.',
  },
  {
    icon: FileText,
    title: 'Practise what matters',
    body: 'A three-stage worksheet targets exactly the skills that went wrong, from a warm-up to test-style questions.',
  },
];

const AUDIENCES = [
  {
    icon: GraduationCap,
    who: 'Students',
    points: [
      'Find out which step went wrong, and why',
      'Short explanations in plain language',
      'Practise only what you actually need',
    ],
  },
  {
    icon: Users,
    who: 'Parents',
    points: [
      'A clear picture of progress, without a tutor bill',
      'Spot the gaps before report-card time',
      'Link to your child with a simple code',
    ],
  },
  {
    icon: School,
    who: 'Teachers',
    points: [
      'Class-wide patterns across the four pillars',
      'Connects with Google Classroom',
      'Progress reports you can share',
    ],
  },
];

const PRIVACY = [
  'Student names are masked before any photo is read',
  'Location and camera details are stripped from every photo',
  'Photos are deleted automatically after 90 days',
  'Delete everything from your account at any time',
];

const FAQ: [q: string, a: string][] = [
  [
    'Which courses does BirdBrains cover?',
    'Ontario Grade 9 (MTH1W) and Grade 10 academic math (MPM2D): linear systems, analytic geometry, quadratics, similar triangles and trigonometry.',
  ],
  [
    'Do I need an account to try it?',
    'No. The How it works page has the student and parent screens built in with a sample quiz, so you can click through everything first. Nothing is saved.',
  ],
  [
    'Does it give the answers?',
    'It shows where the working went off track and what kind of mistake it was, then builds practice to fix it. The goal is understanding, not a finished answer key.',
  ],
  [
    'What does it cost?',
    'There is a free plan with a monthly upload limit. Pro adds unlimited uploads, mood and pacing insights, and nightly practice worksheets. See the plans page for details.',
  ],
];

export default function HomePage() {
  const { profile } = useSession();


  return (
    <div className="space-y-20 pb-8 sm:space-y-24">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pt-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="aero-badge aero-badge--accent">Ontario · MTH1W · MPM2D</span>
            <span className="aero-coord">GR 9–10 MATH</span>
          </div>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-display text-slate-900 sm:text-[3.5rem]">
            See <em className="font-serif font-normal tracking-normal text-brand">why</em> a math answer went wrong, not
            just that it did.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Snap a photo of handwritten work. BirdBrains traces every step, separates slips from real gaps, and builds a
            worksheet that targets exactly what to practise next.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/how-it-works" className="btn btn-lg btn-primary">
              See how it works <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            {IS_LIVE ? (
              <a href="#get-started" className="btn btn-lg btn-secondary">
                {profile ? 'Open my account' : 'Create a free account'}
              </a>
            ) : (
              <Link href="/plans" className="btn btn-lg btn-secondary">
                See plans
              </Link>
            )}
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            {['Try it without an account', 'Works on any phone', 'Made for the Ontario curriculum'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <DiagnosisPreview />
      </section>

      {/* ── Specs ────────────────────────────────────────────────────────── */}
      <dl className="aero-cells m-0 grid-cols-3">
        {SPECS.map(([figure, label]) => (
          <div key={label} className="flex flex-col justify-between gap-2 p-4 sm:p-6">
            <dd className="m-0 font-mono text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{figure}</dd>
            <dt className="text-xs leading-snug text-slate-500 sm:text-sm">{label}</dt>
          </div>
        ))}
      </dl>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section aria-labelledby="how-heading">
        <SectionHeading id="how-heading" n={1} title="How it works" sub="Three steps from a marked test to a plan." />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="card relative p-6">
              <span className="aero-coord absolute right-5 top-5">STEP {String(i + 1).padStart(2, '0')}</span>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.65)]">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold tracking-display text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="btn btn-secondary mt-6">
          Try it with a sample quiz <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      {/* ── Four pillars ─────────────────────────────────────────────────── */}
      <section aria-labelledby="pillars-heading">
        <SectionHeading
          id="pillars-heading"
          n={2}
          title="The 4-Pillar Diagnostic Framework"
          sub="Every mistake is sorted into one of four kinds, because each one is fixed a different way."
        />
        <div className="aero-cells mt-8 sm:grid-cols-2 lg:grid-cols-4">
          {PILLAR_ORDER.map((p, i) => (
            <div key={p} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <PillarBadge pillar={p} />
                <span className="aero-coord">PILLAR {String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-4 font-display font-bold tracking-display text-slate-900">{PILLARS[p].label}</p>
              <p className="mt-1.5 text-sm text-slate-600">
                <MathText text={PILLARS[p].description} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────────── */}
      <section aria-labelledby="who-heading">
        <SectionHeading id="who-heading" n={3} title="Built for the whole team" sub="One photo, three views." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, who, points }) => (
            <div key={who} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-bold tracking-display text-slate-900">For {who.toLowerCase()}</h3>
              </div>
              <ul className="mt-4 space-y-2.5">
                {points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans + privacy ──────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card flex flex-col p-6 sm:p-8">
          <SectionIndex n={4} />
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-display text-slate-900">Start free</h2>
          <p className="mt-2 text-slate-600">
            The free plan reads your work, finds the mistakes across all four pillars and explains them, up to a monthly
            limit. Pro adds unlimited uploads, mood and pacing insights, and nightly practice worksheets.
          </p>
          <div className="mt-auto pt-6">
            <Link href="/plans" className="btn btn-primary">
              <Sparkles className="h-4 w-4" aria-hidden /> Compare plans
            </Link>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8">
          <SectionIndex n={5} />
          <h2 className="mt-2 flex items-center gap-2 font-display text-2xl font-extrabold tracking-display text-slate-900">
            <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden /> Private by design
          </h2>
          <ul className="mt-4 space-y-2.5">
            {PRIVACY.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-slate-600">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Get started ──────────────────────────────────────────────────── */}
      <section id="get-started" aria-labelledby="start-heading" className="scroll-mt-24">
        <SectionHeading
          id="start-heading"
          n={6}
          title="Get started"
          sub={
            IS_LIVE
              ? 'See it working with sample work first, or sign in to upload your own.'
              : 'See it working with sample work.'
          }
        />
        <div className={`mt-8 grid items-start gap-6 ${IS_LIVE ? 'lg:grid-cols-2' : 'max-w-xl'}`}>
          <div className="card p-6">
            <h3 className="font-display text-lg font-bold tracking-display text-slate-900">Try it with sample work</h3>
            <p className="mt-1 text-sm text-slate-600">
              The How it works page has the real student and parent screens built in, filled with a sample quiz. Click
              through both and switch between Free and Pro. No account needed, nothing is saved.
            </p>
            <Link href="/how-it-works" className="btn btn-lg btn-primary mt-5 w-full">
              See how it works <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          {IS_LIVE && <AccountCard />}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section aria-labelledby="faq-heading">
        <SectionHeading id="faq-heading" n={7} title="Questions" />
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl bg-indigo-700 px-6 py-12 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-display text-white sm:text-4xl">
          Got a marked test in your bag? Find out what really went wrong.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-indigo-100">See the student and parent views with a sample quiz. No account needed.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/how-it-works" className="btn btn-lg btn-on-dark">
            See how it works <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <Link href="/plans" className="btn btn-lg border-2 border-white/40 text-white hover:border-white hover:bg-white/10">
            See plans
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ id, n, title, sub }: { id: string; n: number; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <SectionIndex n={n} />
      <h2 id={id} className="mt-2 font-display text-3xl font-extrabold tracking-display text-slate-900">
        {title}
      </h2>
      {sub && <p className="mt-2 text-slate-600">{sub}</p>}
    </div>
  );
}

/** A static picture of what a diagnosis looks like, drawn with the app's own pieces. */
function DiagnosisPreview() {
  const steps: { line: string; ok: boolean; code?: string; pillar?: 'PRC' | 'FAC'; note?: string }[] = [
    { line: 'x^2 - 5x + 6 = 0', ok: true },
    { line: '(x - 2)(x - 3) = 0', ok: true },
    { line: 'x = -2 or x = -3', ok: false, code: 'PRC-03', pillar: 'PRC', note: 'Sign flipped when solving each factor' },
  ];
  return (
    <figure className="relative m-0" aria-label="Example of a BirdBrains diagnosis">
      <div className="aero-blueprint absolute -inset-3 rounded-2xl border border-line sm:-inset-5" aria-hidden />
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Question 4 · Quadratics</span>
          <span className="aero-badge aero-badge--warn">1 issue</span>
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li
              key={i}
              className={`rounded-xl border p-3 ${s.ok ? 'border-slate-200' : 'border-rose-200 bg-rose-50/60'}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">{i + 1}</span>
                <span className="flex-1 text-slate-900">
                  <MathText text={s.line} mode="math" />
                </span>
                {s.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Correct" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" aria-label="Mistake" />
                )}
              </div>
              {!s.ok && s.pillar && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-sm">
                  <PillarBadge pillar={s.pillar} />
                  <span className="font-mono text-xs font-semibold text-slate-700">{s.code}</span>
                  <span className="text-slate-600">{s.note}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-200">
          <span className="font-semibold">Next practice:</span> solving from factored form, 6 questions in 3 stages.
        </div>
      </div>
    </figure>
  );
}
