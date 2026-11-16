import Link from 'next/link';
import { Flame, HeartHandshake, Lock, Sparkles, Sprout } from 'lucide-react';
import type { Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { AFFECT_META } from '@/lib/pillars';
import { MathNumber, MathText } from '@/components/MathText';

export default function AffectCard({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  // affectState is null on the Free plan: show locked Pro mood & friction callout.
  const affect = grading.affectState ? AFFECT_META[grading.affectState] : null;
  const pct = Math.round((grading.totalScore / grading.maxPossibleScore) * 100);
  const highFriction = affect !== null && affect.level >= 2;

  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_auto]">
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-3 ring-1 ring-brand-line">
              <Flame className="h-3.5 w-3.5" aria-hidden /> High Effort Detected
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Sprout className="h-3.5 w-3.5" aria-hidden /> Growth-Mindset Tone
            </span>
          </div>
          <p className="mt-4 text-lg font-medium leading-relaxed text-slate-800">
            <MathText text={grading.supportiveFramingMessage} />
          </p>
          <p className="mt-2 text-sm text-slate-500">
            <MathText text={grading.topic} />
          </p>

          {affect && highFriction && (
            <div className={`mt-5 flex gap-3 rounded-md p-3 text-sm ring-1 ${affect.badge}`} role="status">
              <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Friction level: {affect.label}</p>
                <p className="opacity-90">
                  This one felt tough, and that&apos;s okay. The worksheet below starts with steps already filled in so
                  you can rebuild confidence before going solo.
                </p>
              </div>
            </div>
          )}

          {!affect && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-line bg-brand-soft p-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Lock className="h-3.5 w-3.5 text-brand-3" aria-hidden />
                  Mood &amp; friction insights (Pro)
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Pro spots when a problem feels frustrating or rushed and adjusts practice steps to match.
                </p>
              </div>
              <Link
                href="/plans"
                className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-brand-3 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Upgrade
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center border-t border-line bg-slate-50 p-6 md:border-l md:border-t-0">
          <ScoreRing value={grading.totalScore} max={grading.maxPossibleScore} pct={pct} />
        </div>
      </div>
    </section>
  );
}

function ScoreRing({ value, max, pct }: { value: number; max: number; pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#6366F1"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <MathNumber value={value} className="text-3xl font-bold text-slate-900" />
        <span className="text-xs text-slate-500">
          out of <MathNumber value={max} />
        </span>
      </div>
    </div>
  );
}
