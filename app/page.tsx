'use client';

import { useEffect, useState } from 'react';
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
  Plug,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { PILLARS, PILLAR_ORDER } from '@/lib/pillars';
import type { PillarCategory } from '@/types/birdBrains';
import { IS_LIVE } from '@/lib/api';
import AccountCard from '@/components/AccountCard';
import PillarBadge from '@/components/PillarBadge';
import SectionIndex from '@/components/aero/SectionIndex';
import { useSession } from '@/lib/session';
import { MathText } from '@/components/MathText';

/** Telemetry strip under the hero. Each figure is a fact about the product, not a metric. */
const SPECS: [figure: string, label: string][] = [
  ['06', 'Pillars in every diagnostic'],
  ['06', 'Subjects planned on the same pillars'],
  ['03', 'Stages in each practice worksheet'],
];

const STEPS = [
  {
    icon: Camera,
    title: 'Snap a photo',
    body: 'Take a picture of a test, quiz or homework page, handwriting and all. Quark checks the photo is sharp before it goes anywhere.',
  },
  {
    icon: ScanSearch,
    title: 'See every step diagnosed',
    body: 'Each line of working is read and checked. Mistakes are sorted into the six pillars, so a careless slip never looks like a real gap.',
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
      'Class-wide patterns across the six pillars',
      'Works with Google Classroom, with Canvas and Brightspace next',
      'Progress reports you can share',
    ],
  },
];

/** School systems on the home page. Keep these in step with docs/LMS.md and what is deployed. */
const INTEGRATIONS: { name: string; status: 'Beta' | 'Coming soon'; body: string }[] = [
  {
    name: 'Google Classroom',
    status: 'Beta',
    body: 'Pro teachers import the photos students hand in and see the diagnosis for each one. Students see their Classroom assignments in Quark. Grades stay in Classroom for now. While Google reviews Quark, places are limited, so teachers sign up to test.',
  },
  {
    name: 'Brightspace (D2L)',
    status: 'Coming soon',
    body: 'Import hand-ins from an assignment folder and send scores back as draft feedback you publish yourself. Set up once per school with your Brightspace admin.',
  },
  {
    name: 'Canvas',
    status: 'Coming soon',
    body: 'Import hand-ins from an assignment and send scores and feedback back. Set up once per school with your Canvas admin.',
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
    'Which courses does Quark cover?',
    'Quark grades math from kindergarten to Grade 12. You pick your curriculum and grade, including Ontario, British Columbia, Alberta, Quebec and other provinces, US Common Core and state standards, the National Curriculum in England and GCSE, IB and AP, and Quark pitches the diagnosis to that level. Ontario Grade 9 (MTH1W) and Grade 10 (MPM2D) math have been tested the longest. Chemistry, physics, biology, English and history are next. Their mistake lists are drafted on the same six pillars, but Quark does not grade them yet.',
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
            <span className="aero-badge aero-badge--accent">Your curriculum</span>
            <span className="aero-coord">MATH K–12 LIVE · SCIENCES NEXT</span>
          </div>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-display text-slate-900 sm:text-[3.5rem]">
            See <em className="font-serif font-normal tracking-normal text-brand">why</em> an answer went wrong, not just
            that it did.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Snap a photo of handwritten work. Quark traces every step, sorts each mistake into six pillars so a slip
            never looks like a real gap, and builds practice that targets exactly what to work on next. Pick your
            curriculum and grade: math is live from kindergarten to Grade 12, with sciences, English and history on the
            way.
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
            {['Try it without an account', 'Works on any phone', 'Works with your curriculum'].map((t) => (
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

      {/* ── Six pillars ──────────────────────────────────────────────────── */}
      <section aria-labelledby="pillars-heading">
        <SectionHeading
          id="pillars-heading"
          n={2}
          title="The 6-Pillar Diagnostic Framework"
          sub="Every mistake is sorted into one of six kinds, because each one is fixed a different way. Shown here for math; the sciences, English and history keep the same six, described for each subject."
        />
        <div className="aero-cells mt-8 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ── School systems ─────────────────────────────────────────────── */}
      <section aria-labelledby="lms-heading">
        <SectionHeading
          id="lms-heading"
          n={4}
          title="Works with your school's systems"
          sub="Teachers bring in the work students already hand in, instead of collecting photos twice. Part of Pro for teachers."
        />
        <div className="aero-cells mt-8 md:grid-cols-3">
          {INTEGRATIONS.map(({ name, status, body }) => (
            <div key={name} className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-display font-bold tracking-display text-slate-900">
                  <Plug className="h-4 w-4 text-indigo-600" aria-hidden />
                  {name}
                </span>
                <span className={`aero-badge ${status === 'Beta' ? 'aero-badge--accent' : ''}`}>{status}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-slate-500">
          Microsoft Teams for Education, and opening Quark from inside Canvas or Brightspace, are planned for later.
        </p>
      </section>

      {/* ── Plans + privacy ──────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card flex flex-col p-6 sm:p-8">
          <SectionIndex n={5} />
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-display text-slate-900">Start free</h2>
          <p className="mt-2 text-slate-600">
            The free plan reads your work, finds the mistakes across all six pillars and explains them, up to a monthly
            limit. Pro adds unlimited uploads, mood and pacing insights, and nightly practice worksheets.
          </p>
          <div className="mt-auto pt-6">
            <Link href="/plans" className="btn btn-primary">
              <Sparkles className="h-4 w-4" aria-hidden /> Compare plans
            </Link>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8">
          <SectionIndex n={6} />
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
          n={7}
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
        <SectionHeading id="faq-heading" n={8} title="Questions" />
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

type PreviewStep = {
  line: string;
  ok: boolean;
  /** Shown under a correct line that builds on an earlier mistake. */
  carried?: string;
  pillar?: PillarCategory;
  /** A slip is a one-off; a gap is something to relearn. */
  kind?: 'slip' | 'gap';
  note?: string;
};
type PreviewSample = {
  subject: string;
  topic: string;
  /** Math is graded today; the rest are samples of where Quark is going. */
  live: boolean;
  /** Render lines as math (KaTeX) or as plain written work. */
  math: boolean;
  question: string;
  steps: PreviewStep[];
  next: string;
};

/** Sample work shown in the hero, one per subject. No error codes here: only pillar ids and plain notes. */
const PREVIEW_SAMPLES: PreviewSample[] = [
  {
    subject: 'Math',
    topic: 'Quadratics',
    live: true,
    math: true,
    question: 'A ball’s height is h = −5t² + 20t + 1 metres. Find its maximum height.',
    steps: [
      { line: 't = \\frac{b}{2a} = \\frac{20}{-10} = -2', ok: false, pillar: 'PRC', kind: 'gap', note: 'The vertex is at −b ÷ 2a. The minus sign is part of the formula.' },
      { line: 'h = -5(-2)^2 + 20(-2) + 1', ok: true, carried: 'Correct from step 1' },
      { line: 'h = -20 - 40 + 1 = -59', ok: true, carried: 'Correct from step 1' },
      { line: 'h_{\\text{max}} = -59 \\text{ m}', ok: false, pillar: 'TST', kind: 'slip', note: 'A height below the ground is a sign to go back and check.' },
    ],
    next: 'finding the vertex, then checking it makes sense. 6 questions in 3 stages.',
  },
  {
    subject: 'Chemistry',
    topic: 'Stoichiometry',
    live: false,
    math: false,
    question: 'How many grams of water form when 4 g of hydrogen burns?',
    steps: [
      { line: '2 H₂ + O₂ → 2 H₂O', ok: true },
      { line: 'n(H₂) = 4 g ÷ 2 g/mol = 2 mol', ok: true },
      { line: 'n(H₂O) = 2 mol × ½ = 1 mol', ok: false, pillar: 'STR', kind: 'gap', note: 'The ratio is 2 H₂ to 2 H₂O, so 1 : 1, not 2 : 1.' },
      { line: 'm = 1 × 18 = 18', ok: false, pillar: 'COM', kind: 'slip', note: 'The answer needs units: grams.' },
    ],
    next: 'reading mole ratios from a balanced equation. 6 questions in 3 stages.',
  },
  {
    subject: 'Physics',
    topic: 'Motion',
    live: false,
    math: false,
    question: 'A car speeds up from 5 m/s to 25 m/s in 4 s. How far does it go?',
    steps: [
      { line: 'a = (25 − 5) ÷ 4 = 5 m/s²', ok: true },
      { line: 'd = v₂ × t', ok: false, pillar: 'CON', kind: 'gap', note: 'The speed changes, so v × t with the final speed overshoots. Use d = v₁t + ½at².' },
      { line: 'd = 25 × 4 = 1000 m', ok: false, pillar: 'FAC', kind: 'slip', note: '25 × 4 is 100.' },
      { line: 'The car travels 1000 m.', ok: true, carried: 'Correct from step 3' },
    ],
    next: 'the motion equations and when to use each. 6 questions in 3 stages.',
  },
  {
    subject: 'Biology',
    topic: 'Osmosis',
    live: false,
    math: false,
    question: 'Explain why a red blood cell shrinks in salt water.',
    steps: [
      { line: 'Salt water has more solute than the inside of the cell.', ok: true },
      { line: 'Water crosses the membrane by osmosis.', ok: true },
      { line: 'Water moves into the cell, toward the salt.', ok: false, pillar: 'CON', kind: 'gap', note: 'Water moves out of the cell, toward the side with more solute.' },
      { line: 'So the cell shrinks.', ok: false, pillar: 'COM', kind: 'slip', note: 'Right answer, but it does not follow from step 3.' },
    ],
    next: 'which way water moves, and why. 6 questions in 3 stages.',
  },
  {
    subject: 'History',
    topic: 'Canada in WWI',
    live: false,
    math: false,
    question: 'Was Vimy Ridge a turning point for Canada? Explain.',
    steps: [
      { line: 'Claim: Vimy changed how Canada saw itself.', ok: true },
      { line: 'All four Canadian divisions fought together for the first time.', ok: true },
      { line: 'Canada then signed the peace treaty in 1918.', ok: false, pillar: 'FAC', kind: 'slip', note: 'The Treaty of Versailles was signed in 1919.' },
      { line: 'So it was a very important battle.', ok: false, pillar: 'COM', kind: 'gap', note: 'The evidence is never tied back to the claim.' },
    ],
    next: 'linking evidence back to a claim. 6 short responses in 3 stages.',
  },
  {
    subject: 'English',
    topic: 'Essay writing',
    live: false,
    math: false,
    question: 'Argue whether Jonas is right to leave the community.',
    steps: [
      { line: 'Jonas lives in a community with no memories.', ok: false, pillar: 'TST', kind: 'gap', note: 'Opens with plot summary; the prompt asks for a position.' },
      { line: '“He was certain that he could not go back.”', ok: true },
      { line: 'This shows Jonas is brave.', ok: false, pillar: 'PRC', kind: 'slip', note: 'Names a trait but does not explain how the quote shows it.' },
      { line: 'In the end, leaving was the right choice.', ok: true },
    ],
    next: 'turning a summary into an argument. 6 short responses in 3 stages.',
  },
];

const PREVIEW_INTERVAL_MS = 7000;

/** A picture of what a diagnosis looks like, drawn with the app's own pieces. Rotates through subjects. */
function DiagnosisPreview() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % PREVIEW_SAMPLES.length), PREVIEW_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reducedMotion]);

  return (
    <figure
      className="relative m-0"
      aria-label="Examples of a Quark diagnosis in different subjects"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="aero-blueprint absolute -inset-3 rounded-2xl border border-line sm:-inset-5" aria-hidden />
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.35)] sm:p-6">
        <div role="tablist" aria-label="Subject" className="-mx-1 flex flex-wrap gap-1">
          {PREVIEW_SAMPLES.map((s, i) => (
            <button
              key={s.subject}
              type="button"
              role="tab"
              id={`preview-tab-${i}`}
              aria-controls={`preview-panel-${i}`}
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                i === index ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {s.subject}
            </button>
          ))}
        </div>

        {/* Every sample sits in the same grid cell, so the card keeps the height of the tallest one. */}
        <div className="mt-4 grid">
          {PREVIEW_SAMPLES.map((sample, i) => (
            <PreviewPanel key={sample.subject} sample={sample} index={i} active={i === index} />
          ))}
        </div>
      </div>
    </figure>
  );
}

function PreviewPanel({ sample, index, active }: { sample: PreviewSample; index: number; active: boolean }) {
  const gaps = sample.steps.filter((s) => s.kind === 'gap').length;
  const slips = sample.steps.filter((s) => s.kind === 'slip').length;
  return (
    <div
      role="tabpanel"
      id={`preview-panel-${index}`}
      aria-labelledby={`preview-tab-${index}`}
      aria-hidden={!active}
      className={`[grid-area:1/1] transition-opacity duration-300 motion-reduce:transition-none ${
        active ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">
          {sample.subject} · {sample.topic}
        </span>
        {sample.live ? (
          <span className="aero-badge aero-badge--warn">
            {gaps} gap · {slips} slip
          </span>
        ) : (
          <span className="aero-badge">Coming soon</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-800">{sample.question}</p>
      <ol className="mt-3 space-y-1.5">
        {sample.steps.map((s, i) => (
          <li
            key={i}
            className={`rounded-xl border px-3 py-2 ${s.ok ? 'border-slate-200' : 'border-rose-200 bg-rose-50/60'}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-400">{i + 1}</span>
              <span className="flex-1 text-sm text-slate-900">
                {sample.math ? <MathText text={s.line} mode="math" /> : s.line}
              </span>
              {s.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Correct" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-label="Mistake" />
              )}
            </div>
            {s.ok && s.carried && <p className="mt-0.5 pl-6 text-xs text-emerald-700">{s.carried}</p>}
            {!s.ok && s.pillar && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs">
                <PillarBadge pillar={s.pillar} />
                <span
                  className={`rounded-sm px-1.5 py-[3px] font-mono text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] ${
                    s.kind === 'gap' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {s.kind === 'gap' ? 'Real gap' : 'Slip'}
                </span>
                <span className="text-slate-600">{s.note}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 ring-1 ring-indigo-200">
        <span className="font-semibold">Next practice:</span> {sample.next}
      </div>
    </div>
  );
}
