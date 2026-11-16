import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Stage2GradingAndAffectOutput } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { errorCodeName } from '@/lib/errorCodes';
import { errorCodeHelp, errorCodePillar } from '@/components/student/errorCodeHelp';
import { MathNumber, MathText } from '@/components/MathText';
import PillarBadge from '@/components/PillarBadge';
import SectionIndex from '@/components/aero/SectionIndex';
import type { PillarCategory } from '@/types/birdBrains';

export default function StepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const firstError = grading.stepDiagnostics.find((s) => !s.isCorrect);
  const protectedSteps = grading.stepDiagnostics.filter((s) => s.isCarryForwardProtected);

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-baseline gap-x-2.5 text-lg font-bold text-slate-900">
            <SectionIndex n={3} />
            Step-by-step error localization
          </h2>
          <p className="text-sm text-slate-500">Each line of your work, checked on its own and against what came before.</p>
        </div>
        {protectedSteps.length > 0 && firstError && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <span>
              <strong>Carry-forward protection:</strong> the slip in step <MathNumber value={firstError.stepNumber} /> didn&apos;t cost you
              marks in step <MathText text={protectedSteps.map((s) => s.stepNumber).join(', ')} />.
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
              ? { dot: 'bg-emerald-500', card: 'border-line bg-white' }
              : { dot: 'bg-rose-500', card: 'border-rose-200 bg-rose-50/60' };
          const stepPillar: PillarCategory | undefined = s.pillarImpacted && PILLARS[s.pillarImpacted] ? s.pillarImpacted : undefined;
          return (
            <li key={s.stepNumber} className="relative flex gap-3 pb-4 sm:gap-4">
              {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />}
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-sm font-mono text-xs font-semibold text-white ${tone.dot}`}>
                {String(s.stepNumber).padStart(2, '0')}
              </span>
              <div className={`min-w-0 flex-1 rounded-md border p-3 ${tone.card}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="math max-w-full break-words rounded-sm bg-slate-900/[0.04] px-2.5 py-1 text-base text-slate-900 [overflow-wrap:anywhere]">
                    <MathText mode="math" text={s.studentInput} />
                  </span>
                  {s.isCarryForwardProtected ? (
                    <span className="aero-badge aero-badge--warn">
                      <ShieldCheck className="h-3 w-3" aria-hidden /> Carry-Forward Protected
                    </span>
                  ) : s.isCorrect ? (
                    <span className="aero-badge aero-badge--ok">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Correct
                    </span>
                  ) : (
                    <span className="aero-badge aero-badge--bad">
                      <AlertCircle className="h-3 w-3" aria-hidden /> Error found here
                    </span>
                  )}
                  {stepPillar && (
                    <PillarBadge pillar={stepPillar} label className="ml-auto" />
                  )}
                </div>
                <p className="mt-2 break-words text-sm text-slate-600">
                  <MathText text={s.explanation} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {grading.entityExtractions.length > 0 && (
        <div className="mt-2 border-t border-line pt-4">
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
                  className="min-w-0 rounded-md border border-l-[3px] border-line bg-white p-3.5"
                  style={{ borderLeftColor: pillarColor }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Micro-mapping tags: pillar, official error code, severity. */}
                    {pillarKey ? <PillarBadge pillar={pillarKey} label /> : null}
                    <span className="aero-badge" style={{ color: pillar?.ink }}>
                      {code}
                    </span>
                    <span
                      className={`aero-badge ${
                        m.severity === 'HIGH' ? 'aero-badge--bad' : m.severity === 'MEDIUM' ? 'aero-badge--warn' : ''
                      }`}
                    >
                      {m.severity}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                    <MathText text={plainWords} />
                  </p>

                  {m.description && (
                    <p className="mt-1 break-words text-sm text-slate-600">
                      <MathText text={m.description} />
                    </p>
                  )}

                  {officialName && (
                    <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-slate-500">{officialName}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
