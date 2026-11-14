import { Flame, HeartHandshake, Sprout } from 'lucide-react';
import type { Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { AFFECT_META } from '@/lib/pillars';

export default function AffectCard({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  // affectState is null on the Free plan: no mood or friction panel then.
  const affect = grading.affectState ? AFFECT_META[grading.affectState] : null;
  const pct = Math.round((grading.totalScore / grading.maxPossibleScore) * 100);
  const highFriction = affect !== null && affect.level >= 2;

  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_auto]">
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              <Flame className="h-3.5 w-3.5" aria-hidden /> High Effort Detected
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Sprout className="h-3.5 w-3.5" aria-hidden /> Growth-Mindset Tone
            </span>
          </div>
          <p className="mt-4 text-lg font-medium leading-relaxed text-slate-800">{grading.supportiveFramingMessage}</p>
          <p className="mt-2 text-sm text-slate-500">{grading.topic}</p>

          {affect && highFriction && (
            <div className={`mt-5 flex gap-3 rounded-xl p-3 text-sm ring-1 ${affect.badge}`} role="status">
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
        </div>
        <div className="flex items-center justify-center border-t border-slate-200 bg-slate-50 p-6 md:border-l md:border-t-0">
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
          stroke="#4f46e5"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-slate-900">{value}</span>
        <span className="text-xs text-slate-500">out of {max}</span>
      </div>
    </div>
  );
}
