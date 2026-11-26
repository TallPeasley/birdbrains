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
import { mistakeName } from '@/lib/errorCodes';
import { errorCodeHelp, errorCodePillar } from '@/components/student/errorCodeHelp';
import { PillarQuirkChips } from '@/components/student/Quirks';
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
  // Which question cards are open. One question: open. Several: only the first one that
  // needs work starts open, so the page stays short; the rest open with a tap.
  const [open, setOpen] = useState<Set<string>>(() => {
    if (questions.length <= 1) return new Set(questions.map((q) => q.questionNumber));
    const first = questions.find((q) => !q.finalAnswerVerification.satisfiesInitialQuestion || q.entityExtractions.length > 0);
    return new Set(first ? [first.questionNumber] : []);
  });
  const toggle = (n: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

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
                {questions.length > 1 ? 'Your work, question by question' : 'Your work, step by step'}
              </h2>
              <p className="text-sm text-slate-500">
                We check every step, then put your final answer back into the question to see if it works.
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
          {questions.length > 1 && (
            <div className="flex justify-end gap-2 text-sm">
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={() => setOpen(new Set(questions.map((q) => q.questionNumber)))}
              >
                Open all
              </button>
              <button type="button" className="btn btn-sm btn-link" onClick={() => setOpen(new Set())}>
                Close all
              </button>
            </div>
          )}
          {visible.map((q) => (
            <QuestionCard
              key={q.questionNumber}
              question={q}
              multi={questions.length > 1}
              open={open.has(q.questionNumber) || selectedQuestion === q.questionNumber}
              onToggle={() => toggle(q.questionNumber)}
            />
          ))}
        </div>
      </section>
    );
  }

  // Legacy fallback for older stored gradings that only have flat stepDiagnostics.
  return <LegacyStepDiagnostics grading={grading} />;
}

function QuestionCard({
  question: q,
  multi,
  open,
  onToggle,
}: {
  question: QuestionDiagnostic;
  multi: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const errorSteps = q.stepDiagnostics.filter((s) => !s.isCorrect);
  const verified = q.finalAnswerVerification.satisfiesInitialQuestion;

  const missingCount = q.keyStepChecks.filter((c) => c.status === 'MISSING').length;
  const errorKeyCount = q.keyStepChecks.filter((c) => c.status === 'PRESENT_WITH_ERROR').length;
  const shownCount = q.keyStepChecks.filter(
    (c) => c.status === 'PRESENT' || c.status === 'EQUIVALENT_METHOD'
  ).length;

  // Closed by default: the steps above already show where the mistake is. A skipped
  // step only shows up here, so open it when something is missing.
  const [showKeyDetails, setShowKeyDetails] = useState<boolean>(missingCount > 0);
  // The steps above already say which lines were right or wrong, so by default list only
  // the key steps that never appear in the work (when there are any).
  const [showAllKeySteps, setShowAllKeySteps] = useState(false);
  const visibleKeySteps =
    showAllKeySteps || missingCount === 0 ? q.keyStepChecks : q.keyStepChecks.filter((c) => c.status === 'MISSING');
  const hiddenKeySteps = q.keyStepChecks.length - visibleKeySteps.length;

  return (
    <article className="card p-4 sm:p-6">
      {/* Header: tap to open or close this question */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
            Question {q.questionNumber}
          </span>
          {verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Answer checks out
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              <XCircle className="h-3.5 w-3.5" aria-hidden /> Answer doesn’t check out
            </span>
          )}
        </div>
        <span className="latex-math rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-800">
          <MathNumber value={q.totalScore} />
          <span className="font-medium text-slate-400">
            {' / '}
            <MathNumber value={q.maxPossibleScore} />
          </span>
          <span className="ml-2 inline-flex align-middle text-slate-400">
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            <span className="sr-only">{open ? 'Hide' : 'Show'} question {q.questionNumber}</span>
          </span>
        </span>
      </button>

      {!open && (
        <p className="mt-2 text-sm text-slate-500">
          {q.stepDiagnostics.length} {q.stepDiagnostics.length === 1 ? 'step' : 'steps'}
          {errorSteps.length > 0
            ? `, ${errorSteps.length} with a mistake`
            : verified
              ? ', all correct'
              : ''}
          . Tap to see the full check.
        </p>
      )}

      {open && (
      <>
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

      {/* This question's quirks and antiquirks on pages with several questions; the whole
          upload's six pillars are shown at the top of the dashboard. */}
      {multi && <PillarQuirkChips pillars={q.pillarQuirks} className="mt-3" />}

      {/* The mistakes first, once each; the steps below show where they happened. */}
      <MisconceptionList
        items={q.entityExtractions}
        heading={multi ? `What tripped you up in Question ${q.questionNumber}` : 'What tripped you up'}
      />

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
              Does your final answer work?
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
            {!verified && errorSteps.length === 0 && q.finalAnswerVerification.discrepancyNote && (
              <p className="text-xs font-medium text-rose-800">
                <MathText text={q.finalAnswerVerification.discrepancyNote} />
              </p>
            )}
          </div>
        </div>
      </div>

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
            <span>Answer key and the steps we looked for</span>
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
                  Steps we looked for
                </h3>
                {!showAllKeySteps && hiddenKeySteps > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Showing the steps that were skipped. The rest match your steps above.{' '}
                    <button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={() => setShowAllKeySteps(true)}>
                      Show all {q.keyStepChecks.length}
                    </button>
                  </p>
                )}
                <ul className="mt-2 space-y-2">
                  {visibleKeySteps.map((check) => {
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
                  Answer key
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

      </>
      )}
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
              {s.questionStepNumber || s.stepNumber}
            </span>
            <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tone.card}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="math max-w-full break-words rounded-md bg-slate-900/[0.04] px-2.5 py-1 text-base text-slate-900 [overflow-wrap:anywhere]">
                  <MathText mode="math" text={s.studentInput} />
                </span>
                {s.isCarryForwardProtected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> No marks lost
                  </span>
                ) : s.isCorrect ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Correct
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Mistake here
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

const SEVERITY: Record<string, { label: string; cls: string }> = {
  HIGH: { label: 'Big impact', cls: 'bg-rose-100 text-rose-700' },
  MEDIUM: { label: 'Some impact', cls: 'bg-amber-100 text-amber-800' },
  LOW: { label: 'Small slip', cls: 'bg-slate-200 text-slate-700' },
};

/**
 * The mistakes, in plain words, once each: the same kind of mistake twice shows as one
 * card with both details. No internal codes (PRC_SIGN_OR_FACTOR_DROPPED ...) are shown.
 */
function MisconceptionList({
  items,
  heading,
}: {
  items: Stage2GradingAndAffectOutput['entityExtractions'];
  heading: string;
}) {
  if (items.length === 0) return null;
  const grouped = new Map<string, { severity: string; details: string[] }>();
  for (const m of items) {
    const code = m.misconceptionId || 'UNKNOWN';
    const g = grouped.get(code) ?? { severity: m.severity, details: [] };
    if (m.severity === 'HIGH' || (m.severity === 'MEDIUM' && g.severity === 'LOW')) g.severity = m.severity;
    const d = m.description?.trim();
    if (d && !g.details.includes(d)) g.details.push(d);
    grouped.set(code, g);
  }
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
      <h3 className="eyebrow">{heading}</h3>
      <ul className="mt-3 space-y-3">
        {Array.from(grouped.entries()).map(([code, g]) => {
          const pillarKey = errorCodePillar(code);
          const pillar = pillarKey ? PILLARS[pillarKey] : undefined;
          const pillarColor = pillar?.color ?? '#64748b';
          const sev = SEVERITY[g.severity] ?? SEVERITY.LOW;
          return (
            <li
              key={code}
              className="min-w-0 rounded-xl border border-slate-200 border-l-4 bg-slate-50/70 p-3.5"
              style={{ borderLeftColor: pillarColor }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-semibold text-slate-900">{mistakeName(code)}</p>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sev.cls}`}>{sev.label}</span>
                {pillar && (
                  <span className="text-[11px] font-medium" style={{ color: pillarColor }}>
                    {pillar.short}
                  </span>
                )}
              </div>
              {(g.details.length ? g.details : [errorCodeHelp(code)]).map((d) => (
                <p key={d} className="mt-1 break-words text-sm text-slate-600">
                  <MathText text={d} />
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Gradings made before questions were graded one by one: a flat list of steps, each tagged
 * with its question. Steps are grouped under their printed question and numbered within it.
 */
function LegacyStepDiagnostics({ grading }: { grading: Stage2GradingAndAffectOutput }) {
  const firstError = grading.stepDiagnostics.find((s) => !s.isCorrect);
  const protectedSteps = grading.stepDiagnostics.filter((s) => s.isCarryForwardProtected);
  const groups = groupByQuestion(grading);
  const showQuestions = groups.length > 1 || groups.some((g) => g.text);
  // Step numbers restart in each question, so name the question too when there is more than one.
  const stepName = (s: StepDiagnostic) => {
    const n = s.questionStepNumber || s.stepNumber;
    if (groups.length < 2) return String(n);
    const gi = groups.findIndex((g) => g.steps.includes(s));
    return `${n} of question ${questionName(groups[gi].label, gi)}`;
  };

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Your work, step by step</h2>
          <p className="text-sm text-slate-500">
            Each line of your work, checked on its own and against what came before.
          </p>
        </div>
        {protectedSteps.length > 0 && firstError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <span>
              <strong>No marks lost later:</strong> the slip in step <MathText text={stepName(firstError)} />{' '}
              didn&apos;t cost you marks in step <MathText text={protectedSteps.map(stepName).join(', ')} />.
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-6">
        {groups.map((g, gi) => (
          <div key={`${g.label}-${gi}`}>
            {showQuestions && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  Question {questionName(g.label, gi)}
                </p>
                {g.text ? (
                  <p className="mt-1.5 break-words text-sm text-slate-800 [overflow-wrap:anywhere]">
                    <MathText text={g.text} />
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-500">The printed question couldn&apos;t be read from the photo.</p>
                )}
              </div>
            )}
            <StepTimeline steps={g.steps} keyPrefix={`legacy-${gi}`} />
          </div>
        ))}
      </div>
      <MisconceptionList items={grading.entityExtractions} heading="What tripped you up" />
    </section>
  );
}

interface QuestionGroup {
  label: string;
  text: string;
  steps: StepDiagnostic[];
}

/** "a" -> "a", "2" -> "2", "" -> its place on the page. */
function questionName(label: string, index: number): string {
  return label ? label : String(index + 1);
}

/** Steps grouped by question, in page order, each with its printed question text. */
function groupByQuestion(grading: Stage2GradingAndAffectOutput): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  for (const s of grading.stepDiagnostics) {
    const label = s.questionLabel ?? '';
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, text: '', steps: [] };
      groups.push(g);
    }
    g.steps.push(s);
  }
  const questions = grading.questions ?? [];
  groups.forEach((g, i) => {
    g.text =
      (questions.find((q) => q.label === g.label) ?? (questions.length === groups.length ? questions[i] : undefined))
        ?.text ?? '';
  });
  return groups;
}
