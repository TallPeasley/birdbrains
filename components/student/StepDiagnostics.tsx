import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { errorCodeName } from '@/lib/errorCodes';

export default function StepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const firstError = grading.stepDiagnostics.find((s) => !s.isCorrect);
  const protectedSteps = grading.stepDiagnostics.filter((s) => s.isCarryForwardProtected);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Step-by-step error localization</h2>
          <p className="text-sm text-slate-500">Each line of your work, checked on its own and against what came before.</p>
        </div>
        {protectedSteps.length > 0 && firstError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 text-amber-600" aria-hidden />
            <span>
              <strong>Carry-forward protection:</strong> the slip in step {firstError.stepNumber} didn&apos;t cost you
              marks in step {protectedSteps.map((s) => s.stepNumber).join(', ')}.
            </span>
          </div>
        )}
      </div>

      <ol className="mt-5 space-y-0">
        {grading.stepDiagnostics.map((s, i) => {
          const last = i === grading.stepDiagnostics.length - 1;
          const tone = s.isCarryForwardProtected
            ? { dot: 'bg-amber-500', card: 'border-amber-200 bg-amber-50/60' }
            : s.isCorrect
              ? { dot: 'bg-emerald-500', card: 'border-slate-200 bg-white' }
              : { dot: 'bg-rose-500', card: 'border-rose-200 bg-rose-50/60' };
          return (
            <li key={s.stepNumber} className="relative flex gap-4 pb-4">
              {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />}
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${tone.dot}`}>
                {s.stepNumber}
              </span>
              <div className={`flex-1 rounded-xl border p-3 ${tone.card}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="math rounded-md bg-slate-900/[0.04] px-2 py-1 text-slate-900">{s.studentInput}</code>
                  {s.isCarryForwardProtected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Carry-Forward Protected
                    </span>
                  ) : s.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Error found here
                    </span>
                  )}
                  {s.pillarImpacted && (
                    <span className="ml-auto text-[11px] font-medium text-slate-400">{PILLARS[s.pillarImpacted].short}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">{s.explanation}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {grading.entityExtractions.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-4">
          <h3 className="eyebrow">Misconceptions detected</h3>
          <ul className="mt-2 space-y-2">
            {grading.entityExtractions.map((m) => (
              <li key={m.misconceptionId} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    m.severity === 'HIGH'
                      ? 'bg-rose-100 text-rose-700'
                      : m.severity === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {m.severity}
                </span>
                <span className="text-slate-700">
                  {m.description}{' '}
                  <span className="font-mono text-xs text-slate-400">
                    {m.misconceptionId}
                    {errorCodeName(m.misconceptionId) ? ` · ${errorCodeName(m.misconceptionId)}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
