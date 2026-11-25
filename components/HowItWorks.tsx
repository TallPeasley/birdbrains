'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Camera, FileText, GraduationCap, ScanSearch, Sparkles, Users } from 'lucide-react';
import { StudentDemo } from '@/components/student/StudentDashboard';
import { ParentDemo } from '@/components/parent/ParentDashboard';
import SectionIndex from '@/components/aero/SectionIndex';
import { demoPersonas } from '@/lib/mockData';
import { IS_LIVE } from '@/lib/api';
import type { PlanTier } from '@/types/birdBrains';

const STEPS = [
  { icon: Camera, title: 'Snap a photo', body: 'A test, quiz or homework page, handwriting and all.' },
  { icon: ScanSearch, title: 'Every step is checked', body: 'Mistakes are sorted into the six pillars.' },
  { icon: FileText, title: 'Practise what matters', body: 'A worksheet aimed at exactly what went wrong.' },
];

/**
 * How it works, with the product built in: the sample student (Alex) on top and the sample parent (Jordan)
 * below, both drawn from mock data with no sign-in, session or API calls. One plan switch drives both views,
 * so Free and Pro always match. This replaces the old site-wide demo mode.
 */
export default function HowItWorks() {
  const [plan, setPlan] = useState<PlanTier>('pro');

  return (
    <div className="space-y-14 pb-8">
      <header className="max-w-3xl pt-2 lg:pt-6">
        <span className="aero-badge aero-badge--accent">Interactive demo · sample data</span>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-display text-slate-900 sm:text-5xl">
          How BirdBrains works
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          {demoPersonas.student.name} uploaded a photo of a quadratics quiz. Below is exactly what {demoPersonas.student.name.split(' ')[0]} sees,
          and then what {demoPersonas.parent.name.split(' ')[0]}, a parent, sees. Click around: open steps, flip through the worksheet,
          and switch between Free and Pro. Nothing here is saved.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="card flex gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="aero-coord block">STEP {String(i + 1).padStart(2, '0')}</span>
                <span className="mt-1 block font-semibold text-slate-900">{title}</span>
                <span className="block text-sm text-slate-600">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      {/* Plan switch: sticks under the header so it stays in reach while scrolling both views. */}
      <div className="sticky top-[57px] z-20 -mx-4 border-y border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 max-[719px]:top-[110px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-2 text-sm" aria-label="Jump to">
            <a href="#student-demo" className="btn btn-sm btn-secondary">
              <GraduationCap className="h-4 w-4" aria-hidden /> Student view
            </a>
            <a href="#parent-demo" className="btn btn-sm btn-secondary">
              <Users className="h-4 w-4" aria-hidden /> Parent view
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Show plan:</span>
            <div role="radiogroup" aria-label="Plan" className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-50 p-1">
              {(['free', 'pro'] as PlanTier[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={plan === t}
                  onClick={() => setPlan(t)}
                  className={`min-h-[36px] rounded-lg px-4 text-sm font-semibold transition ${
                    plan === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {t === 'free' ? 'Free' : 'Pro'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DemoSection
        id="student-demo"
        n={1}
        icon={GraduationCap}
        title={`The student view · ${demoPersonas.student.name}`}
        sub="Every step of the quiz, checked. Mistakes are tagged by pillar, explained in plain words, and turned into practice."
      >
        <StudentDemo plan={plan} />
      </DemoSection>

      <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <ArrowDown className="h-4 w-4" aria-hidden /> The same work, seen by a parent
      </div>

      <DemoSection
        id="parent-demo"
        n={2}
        icon={Users}
        title={`The parent view · ${demoPersonas.parent.name}`}
        sub="Progress over time, which strands are solid, where the mistakes come from, and an EQAO forecast."
      >
        <ParentDemo plan={plan} />
      </DemoSection>

      <section className="overflow-hidden rounded-2xl bg-indigo-700 px-6 py-12 text-center sm:px-12">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-display text-white sm:text-4xl">
          Ready to try it on real work?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-indigo-100">
          {IS_LIVE ? 'Create a free account and upload your first photo.' : 'See what each plan includes.'}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {IS_LIVE && (
            <Link href="/#get-started" className="btn btn-lg btn-on-dark">
              Create a free account <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <Link href="/plans" className="btn btn-lg border-2 border-white/40 text-white hover:border-white hover:bg-white/10">
            <Sparkles className="h-5 w-5" aria-hidden /> Compare plans
          </Link>
        </div>
      </section>
    </div>
  );
}

function DemoSection({
  id,
  n,
  icon: Icon,
  title,
  sub,
  children,
}: {
  id: string;
  n: number;
  icon: typeof Users;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-40">
      <div className="max-w-3xl">
        <SectionIndex n={n} code="DEMO" />
        <h2 id={`${id}-title`} className="mt-2 flex items-center gap-2 font-display text-2xl font-extrabold tracking-display text-slate-900 sm:text-3xl">
          <Icon className="h-6 w-6 text-indigo-600" aria-hidden /> {title}
        </h2>
        <p className="mt-2 text-slate-600">{sub}</p>
      </div>
      {/* The app itself, framed so it reads as a screen rather than part of this page. */}
      <div className="mt-6 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.35)] sm:p-6">
        {children}
      </div>
    </section>
  );
}
