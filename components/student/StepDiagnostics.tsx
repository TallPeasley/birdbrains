'use client';

import { useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  KeyStepCheckStatus,
  QuestionDiagnostic,
  Stage2GradingAndAffectOutput,
  StepDiagnostic,
} from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { errorCodeName } from '@/lib/errorCodes';
import { errorCodeHelp, errorCodePillar } from '@/components/student/errorCodeHelp';
import { MathNumber, MathText } from '@/components/MathText';

const KEY_STEP_BADGE: Record<
  KeyStepCheckStatus,
  { label: string; badgeClass: string; rowClass: string }
> = {
  PRESENT: {
    label: 'Shown on worksheet',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    rowClass: 'border-emerald-200/80 bg-emerald-50/40',
  },
  EQUIVALENT_METHOD: {
    label: 'Equivalent method',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    rowClass: 'border-indigo-200/80 bg-indigo-50/40',
  },
  PRESENT_WITH_ERROR: {
    label: 'Attempted with error',
    badgeClass: 'bg-rose-100 text-rose-800',
    rowClass: 'border-rose-200/80 bg-rose-50/40',
  },
  MISSING: {
    label: 'Missing from worksheet',
    badgeClass: 'bg-amber-100 text-amber-900',
    rowClass: 'border-amber-200/90 bg-amber-50/50',
  },
};

export default function StepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const questions = grading.questionAnalyses ?? [];
  const [selectedQuestion, setSelectedQuestion] = useState<string>('ALL');

  // Modern per-question path: every question is analysed and displayed in isolation.
  if (questions.length > 0) {
    const visible =
      selectedQuestion === 'ALL'
        ? questions
        : questions.filter((q) => q.questionNumber === selectedQuestion);

    return (
      <section className="space-y-4">
        <div className="card p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {questions.length > 1
                  ? 'Question-by-question error localization'
                  : 'Step-by-step error localization'}
              </h2>
              <p className="text-sm text-slate-500">
                Each question is checked independently against a generated answer key, key-step
                coverage, and re-substitution into the original prompt.
              </p>
            </div>
          </div>

          {questions.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by question">
              <button
                type="button"
                role="tab"
                aria-selected={selectedQuestion === 'ALL'}
                onClick={() => setSelectedQuestion('ALL')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedQuestion === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All questions ({questions.length})
              </button>
              {questions.map((q) => {
                const active = selectedQuestion === q.questionNumber;
                const clean =
                  q.finalAnswerVerification.satisfiesInitialQuestion &&
                  q.entityExtractions.length === 0;
                return (
                  <button
                    key={q.questionNumber}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedQuestion(q.questionNumber)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        clean ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      aria-hidden
                    />
                    <span>Q{q.questionNumber}</span>
                    <span className={active ? 'text-indigo-100' : 'text-slate-500'}>
                      · <MathNumber value={q.totalScore} />/<MathNumber value={q.maxPossibleScore} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {visible.map((q) => (
            <QuestionCard key={q.questionNumber} question={q} multi={questions.length > 1} />
          ))}
        </div>
      </section>
    );
  }

  // Legacy fallback for older stored gradings that only have flat stepDiagnostics.
  return <LegacyStepDiagnostics grading={grading} />;
}

function QuestionCard({ question: q, multi }: { question: QuestionDiagnostic; multi: boolean }) {
  const errorSteps = q.stepDiagnostics.filter((s) => !s.isCorrect);
  const protectedSteps = q.stepDiagnostics.filter((s) => s.isCarryForwardProtected);
  const verified = q.finalAnswerVerification.satisfiesInitialQuestion;

  const missingCount = q.keyStepChecks.filter((c) => c.status === 'MISSING').length;
  const errorKeyCount = q.keyStepChecks.filter((c) => c.status === 'PRESENT_WITH_ERROR').length;
  const shownCount = q.keyStepChecks.filter(
    (c) => c.status === 'PRESENT' || c.status === 'EQUIVALENT_METHOD'
  ).length;

  const [showKeyDetails, setShowKeyDetails] = useState<boolean>(
    !verified || missingCount > 0 || errorKeyCount > 0
  );

  return (
    <article className="card p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
            Question {q.questionNumber}
          </span>
          {verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verified against initial question
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              <XCircle className="h-3.5 w-3.5" aria-hidden /> Final answer fails check
            </span>
          )}
        </div>
        <span className="latex-math rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-800">
          <MathNumber value={q.totalScore} />
          <span className="font-medium text-slate-400">
            {' / '}
            <MathNumber value={q.maxPossibleScore} />
          </span>
        </span>
      </div>

      {/* Verbatim problem statement */}
      {q.problemStatement && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Original question
          </p>
          <p className="mt-1 font-medium text-slate-900">
            <MathText text={q.problemStatement} />
          </p>
        </div>
      )}

      {/* Final-answer re-substitution verification */}
      <div
        className={`mt-3 rounded-xl border p-3.5 text-sm ${
          verified
            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
            : 'border-rose-200 bg-rose-50/60 text-rose-950'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <FileCheck2
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              verified ? 'text-emerald-600' : 'text-rose-600'
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-semibold">
              Final-answer check (re-substituted into initial question)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-200/80">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Your conclusion
                </span>
                <span className="mt-0.5 block text-sm text-slate-900">
                  <MathText text={q.finalAnswerVerification.studentFinalAnswer || 'None / incomplete'} />
                </span>
              </div>
              <div className="rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-200/80">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Answer key
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-slate-900">
                  <MathText text={q.answerKey.finalAnswer} />
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              <MathText text={q.finalAnswerVerification.resubstitutionCheck} />
            </p>
            {!verified && q.finalAnswerVerification.discrepancyNote && (
              <p className="text-xs font-medium text-rose-800">
                <MathText text={q.finalAnswerVerification.discrepancyNote} />
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Per-question carry-forward protection banner (strictly isolated to THIS question) */}
      {protectedSteps.length > 0 && errorSteps.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <span>
            <strong>Carry-forward protection (Q{q.questionNumber}):</strong>{' '}
            {errorSteps.length === 1 ? (
              <>
                the slip in step <MathNumber value={errorSteps[0].stepNumber} /> didn&apos;t cost
                you marks in step{' '}
                <MathText text={protectedSteps.map((s) => s.stepNumber).join(', ')} />.
              </>
            ) : (
              <>
                earlier slips in Question <MathNumber value={q.questionNumber} /> didn&apos;t cost
                you marks in step{' '}
                <MathText text={protectedSteps.map((s) => s.stepNumber).join(', ')} />.
              </>
            )}
          </span>
        </div>
      )}

      {/* Per-question step-by-step timeline */}
      {q.stepDiagnostics.length > 0 ? (
        <StepTimeline steps={q.stepDiagnostics} keyPrefix={`q${q.questionNumber}`} />
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm text-amber-900">
          No written steps were found on the worksheet for Question {q.questionNumber}.
        </div>
      )}

      {/* Key-step coverage + Generated Answer Key */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60">
        <button
          type="button"
          onClick={() => setShowKeyDetails((v) => !v)}
          aria-expanded={showKeyDetails}
          className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100/70"
        >
          <span className="inline-flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-indigo-600" aria-hidden />
            <span>Answer key &amp; key-step coverage</span>
          </span>
          <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            {q.keyStepChecks.length > 0 && (
              <span>
                <MathNumber value={shownCount} />/<MathNumber value={q.keyStepChecks.length} /> key
                steps matched
                {errorKeyCount > 0 && (
                  <span className="text-rose-700">
                    {' · '}
                    <MathNumber value={errorKeyCount} /> with error
                  </span>
                )}
                {missingCount > 0 && (
                  <span className="text-amber-800">
                    {' · '}
                    <MathNumber value={missingCount} /> missing
                  </span>
                )}
              </span>
            )}
            {showKeyDetails ? (
              <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
            )}
          </span>
        </button>

        {showKeyDetails && (
          <div className="space-y-4 border-t border-slate-200 bg-white p-3.5 sm:p-4">
            {/* Key-step worksheet coverage */}
            {q.keyStepChecks.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
                  Key steps checked on your worksheet
                </h3>
                <ul className="mt-2 space-y-2">
                  {q.keyStepChecks.map((check) => {
                    const meta = KEY_STEP_BADGE[check.status];
                    return (
                      <li
                        key={check.keyStepNumber}
                        className={`rounded-lg border p-2.5 text-xs ${meta.rowClass}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-700">
                            Key step <MathNumber value={check.keyStepNumber} />
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          {check.matchedStudentSteps.length > 0 && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Your step{check.matchedStudentSteps.length > 1 ? 's' : ''}{' '}
                              <MathText text={check.matchedStudentSteps.join(', ')} />
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-medium text-slate-800">
                          <MathText text={check.keyStepDescription} />
                        </p>
                        {check.expectedMath && (
                          <div className="mt-1">
                            <span className="math inline-block rounded bg-white/90 px-2 py-0.5 text-sm text-slate-900 ring-1 ring-slate-200/80">
                              <MathText mode="math" text={check.expectedMath} />
                            </span>
                          </div>
                        )}
                        {check.note && (
                          <p className="mt-1 text-slate-600">
                            <MathText text={check.note} />
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Generated Answer Key */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Generated answer key
                </h3>
                {q.answerKey.methodUsed && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    Method: {q.answerKey.methodUsed}
                  </span>
                )}
              </div>
              <ol className="mt-2 space-y-1.5">
                {q.answerKey.steps.map((step) => (
                  <li
                    key={step.stepNumber}
                    className="flex items-start gap-2.5 rounded-lg bg-slate-50/80 px-2.5 py-2 text-xs"
                  >
                    <span className="latex-num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                      {step.stepNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700">
                        <MathText text={step.description} />
                      </p>
                      {step.expectedMath && (
                        <p className="mt-0.5 text-sm text-slate-900">
                          <MathText mode="math" text={step.expectedMath} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-2.5 rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-950">
                <p>
                  <strong>Final answer:</strong>{' '}
                  <MathText text={q.answerKey.finalAnswer} />
                </p>
                {q.answerKey.answerVerification && (
                  <p className="mt-1 text-indigo-900/90">
                    <strong>Verification:</strong>{' '}
                    <MathText text={q.answerKey.answerVerification} />
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-question root-cause errors */}
      <MisconceptionList
        items={q.entityExtractions}
        heading={multi ? `What tripped you up in Question ${q.questionNumber}` : 'What tripped you up'}
      />
    </article>
  );
}

function StepTimeline({ steps, keyPrefix }: { steps: StepDiagnostic[]; keyPrefix: string }) {
  return (
    <ol className="mt-5 space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const tone = s.isCarryForwardProtected
          ? { dot: 'bg-amber-500', card: 'border-amber-200 bg-amber-50/60' }
          : s.isCorrect
            ? { dot: 'bg-emerald-500', card: 'border-slate-200 bg-white' }
            : { dot: 'bg-rose-500', card: 'border-rose-200 bg-rose-50/60' };
        const stepPillar =
          s.pillarImpacted && PILLARS[s.pillarImpacted] ? PILLARS[s.pillarImpacted] : undefined;
        return (
          <li key={`${keyPrefix}-${s.stepNumber}-${i}`} className="relative flex gap-3 pb-4 sm:gap-4">
            {!last && (
              <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" aria-hidden />
            )}
            <span
              className={`latex-num relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${tone.dot}`}
            >
              {s.stepNumber}
            </span>
            <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tone.card}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="math max-w-full break-words rounded-md bg-slate-900/[0.04] px-2.5 py-1 text-base text-slate-900 [overflow-wrap:anywhere]">
                  <MathText mode="math" text={s.studentInput} />
                </span>
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
              <p className="mt-2 break-words text-sm text-slate-600">
                <MathText text={s.explanation} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MisconceptionList({
  items,
  heading,
}: {
  items: Stage2GradingAndAffectOutput['entityExtractions'];
  heading: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h3 className="eyebrow">{heading}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((m, idx) => {
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
                  {pillar ? pillar.short : <MathText text={code} />}
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
                <MathText text={plainWords} />
              </p>

              {m.description && (
                <p className="mt-1 break-words text-sm text-slate-600">
                  <MathText text={m.description} />
                </p>
              )}

              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold" style={{ color: pillarColor }}>
                  <MathText text={code} />
                </span>
                {officialName && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      <MathText text={officialName} />
                    </span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LegacyStepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const firstError = grading.stepDiagnostics.find((s) => !s.isCorrect);
  const protectedSteps = grading.stepDiagnostics.filter((s) => s.isCarryForwardProtected);

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Step-by-step error localization</h2>
          <p className="text-sm text-slate-500">
            Each line of your work, checked on its own and against what came before.
          </p>
        </div>
        {protectedSteps.length > 0 && firstError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <span>
              <strong>Carry-forward protection:</strong> the slip in step{' '}
              <MathNumber value={firstError.stepNumber} /> didn&apos;t cost you marks in step{' '}
              <MathText text={protectedSteps.map((s) => s.stepNumber).join(', ')} />.
            </span>
          </div>
        )}
      </div>

      <StepTimeline steps={grading.stepDiagnostics} keyPrefix="legacy" />
      <MisconceptionList items={grading.entityExtractions} heading="What tripped you up" />
    </section>
  );
}
