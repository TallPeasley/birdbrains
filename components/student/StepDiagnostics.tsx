import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { errorCodeName } from '@/lib/errorCodes';
import { errorCodeHelp, errorCodePillar } from '@/lib/errorCodeHelp';

export default function StepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const firstError = grading.stepDiagnostics.find((s) => !s.isCorrect);
  const protectedSteps = grading.stepDiagnostics.filter((s) => s.isCarryForwardProtected);

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Step-by-step error localization</h2>
          <p className="text-sm text-slate-500">Each line of your work, checked on its own and against what came before.</p>
        </div>
        {protectedSteps.length > 0 && firstError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
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
          const stepPillar = s.pillarImpacted && PILLARS[s.pillarImpacted] ? PILLARS[s.pillarImpacted] : undefined;
          return (
            <li key={s.stepNumber} className="relative flex gap-3 pb-4 sm:gap-4">
              {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />}
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${tone.dot}`}>
                {s.stepNumber}
              </span>
              <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tone.card}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="math max-w-full break-words rounded-md bg-slate-900/[0.04] px-2 py-1 text-slate-900 [overflow-wrap:anywhere]">
                    {s.studentInput}
                  </code>
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
                  {stepPillar && (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stepPillar.color }}
                        aria-hidden
                      />
                      {stepPillar.short}
                    </span>
                  )}
                </div>
                <p className="mt-2 break-words text-sm text-slate-600">{s.explanation}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {grading.entityExtractions.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-4">
          <h3 className="eyebrow">What tripped you up</h3>
          <ul className="mt-3 space-y-3">
            {grading.entityExtractions.map((m, idx) => {
              const code = m.misconceptionId || 'UNKNOWN';
              const plainWords = errorCodeHelp(code);
              const officialName = errorCodeName(code);
              const pillarKey = errorCodePillar(code);
              const pillar = pillarKey ? PILLARS[pillarKey] : undefined;
              const pillarColor = pillar?.color ?? '#64748b';

              return (
                <li
                  key={`${code}-${idx}`}
                  className="min-w-0 rounded-xl border border-slate-200 border-l-4 bg-slate-50/70 p-3.5"
                  style={{ borderLeftColor: pillarColor }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: pillarColor }}
                    >
                      {pillar ? pillar.short : code}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        m.severity === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : m.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {m.severity}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                    {plainWords}
                  </p>

                  {m.description && (
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {m.description}
                    </p>
                  )}

                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono font-semibold" style={{ color: pillarColor }}>
                      {code}
                    </span>
                    {officialName && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{officialName}</span>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
