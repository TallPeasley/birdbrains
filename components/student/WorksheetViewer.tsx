'use client';

import { useState } from 'react';
import { ArrowDown, CheckCircle2, Eye, Lightbulb, RotateCcw, XCircle } from 'lucide-react';
import type { FadedScaffoldingStep, StepDiagnostic, WS_3STAGE_V1 } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { formatMathPlaceholder, MathNumber, MathText } from '@/components/MathText';

const SECTIONS = [
  { key: 'A', title: 'Diagnostic Mirror', sub: 'Where it went wrong' },
  { key: 'B', title: 'Faded Scaffolding', sub: 'Guided practice' },
  { key: 'C', title: 'Independent Transfer', sub: 'Try it solo + reflect' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function WorksheetViewer({ worksheet, steps }: { worksheet: WS_3STAGE_V1; steps?: StepDiagnostic[] }) {
  const [active, setActive] = useState<SectionKey>('A');

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 p-4 pb-0 sm:p-6 sm:pb-0">
        <p className="eyebrow">Your remedial worksheet</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          <MathText text={worksheet.title} />
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Target concept: <MathText text={worksheet.targetConcept} />
        </p>

        <div role="tablist" aria-label="Worksheet sections" className="mt-5 grid grid-cols-3 gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              role="tab"
              id={`tab-${s.key}`}
              aria-selected={active === s.key}
              aria-controls={`panel-${s.key}`}
              onClick={() => setActive(s.key)}
              className={`-mb-px min-w-0 border-b-2 px-1.5 pb-3 text-left transition sm:px-2 ${
                active === s.key ? 'border-indigo-600' : 'border-transparent hover:border-slate-300'
              }`}
            >
              <span className={`block text-xs font-bold ${active === s.key ? 'text-indigo-600' : 'text-slate-400'}`}>
                Section {s.key}
              </span>
              <span className={`block break-words text-xs font-semibold sm:text-sm ${active === s.key ? 'text-slate-900' : 'text-slate-600'}`}>
                {s.title}
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">{s.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === 'A' && <DiagnosticMirror worksheet={worksheet} steps={steps} />}
        {active === 'B' && <FadedScaffolding steps={worksheet.sectionB_FadedScaffolding} />}
        {active === 'C' && <IndependentTransfer worksheet={worksheet} />}
      </div>
    </section>
  );
}

const squash = (t: string) => t.replace(/\s+/g, '');

/**
 * Show the move that went wrong as two lines of the student's own work: the line before (correct) and the
 * line with the mistake, with the wrong piece marked and the right piece beside it. Older worksheets have no
 * previousStepText, so the line before is looked up in the graded steps when we have them.
 */
function DiagnosticMirror({ worksheet, steps }: { worksheet: WS_3STAGE_V1; steps?: StepDiagnostic[] }) {
  return (
    <div className="space-y-8">
      {worksheet.sectionA_DiagnosticMirror.map((item, i) => {
        const idx = steps?.findIndex((s) => squash(s.studentInput) === squash(item.originalStepText)) ?? -1;
        const wrongStep = idx >= 0 ? steps![idx] : undefined;
        const before = item.previousStepText || (idx > 0 ? steps![idx - 1].studentInput : '');
        const beforeNumber = idx > 0 ? steps![idx - 1].stepNumber : undefined;
        const why = item.whatWentWrong || wrongStep?.explanation || '';
        return (
          <div key={i} className="space-y-4">
            <p className="text-sm text-slate-600">
              Here is the exact move where it went off track{wrongStep ? ` (step ${wrongStep.stepNumber})` : ''}.
            </p>

            <ol className="space-y-0">
              {before && (
                <li className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <StepLabel tone="ok" text={beforeNumber ? `Step ${beforeNumber} · your line before` : 'Your line before'} />
                  <p className="math mt-2 break-words text-base text-slate-800 sm:text-lg [overflow-wrap:anywhere]">
                    <MathText mode="math" text={before} />
                  </p>
                </li>
              )}
              {before && (
                <li aria-hidden className="flex items-center gap-2 py-2 pl-5 text-sm font-medium text-rose-700">
                  <ArrowDown className="h-4 w-4" /> the mistake happens in this move
                </li>
              )}
              <li className="rounded-xl border-2 border-rose-300 bg-rose-50/60 p-4">
                <StepLabel
                  tone="bad"
                  text={wrongStep ? `Step ${wrongStep.stepNumber} · what you wrote` : 'What you wrote'}
                />
                <p className="math mt-2 break-words text-base text-slate-800 sm:text-lg [overflow-wrap:anywhere]">
                  <Marked text={item.originalStepText} part={item.wrongPart} tone="bad" />
                </p>
                {item.wrongPart && item.correctPart && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                      <MathText mode="math" text={item.wrongPart} />
                    </span>
                    <span>should be</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      <MathText mode="math" text={item.correctPart} />
                    </span>
                  </p>
                )}
              </li>
            </ol>

            {why && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">What went wrong</p>
                <p className="mt-1.5">
                  <MathText text={why} />
                </p>
              </div>
            )}

            <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <StepLabel tone="ok" text="The fix" />
              <div className="math mt-2 space-y-1 break-words text-base text-slate-800 sm:text-lg [overflow-wrap:anywhere]">
                {item.annotatedCorrection.split('=>').map((line, j, all) => (
                  <p key={j}>
                    {j > 0 && <span className="latex-op mr-2 text-emerald-600">⇒</span>}
                    {j === all.length - 1 && item.correctPart ? (
                      <Marked text={line.trim()} part={item.correctPart} tone="ok" />
                    ) : (
                      <MathText mode="math" text={line.trim()} />
                    )}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900 ring-1 ring-indigo-200">
              <Lightbulb className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
              <p>
                <strong>Key takeaway:</strong> <MathText text={item.keyTakeaway} />
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepLabel({ tone, text }: { tone: 'ok' | 'bad'; text: string }) {
  const Icon = tone === 'ok' ? CheckCircle2 : XCircle;
  return (
    <p
      className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${
        tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {text}
    </p>
  );
}

/** A line of maths with one piece highlighted. Falls back to the plain line if the piece isn't in it. */
function Marked({ text, part, tone }: { text: string; part?: string; tone: 'ok' | 'bad' }) {
  const at = part ? text.lastIndexOf(part) : -1;
  if (!part || at < 0) return <MathText mode="math" text={text} />;
  const head = text.slice(0, at).trim();
  const tail = text.slice(at + part.length).trim();
  return (
    <>
      {head && <MathText mode="math" text={head} />}{' '}
      <mark
        className={`rounded-md px-1.5 py-0.5 ring-2 ${
          tone === 'bad' ? 'bg-rose-200/70 text-rose-900 ring-rose-400' : 'bg-emerald-200/70 text-emerald-900 ring-emerald-400'
        }`}
      >
        <MathText mode="math" text={part} />
      </mark>{' '}
      {tail && <MathText mode="math" text={tail} />}
    </>
  );
}

const BLANK = '[ __ ]';
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function FadedScaffolding({ steps }: { steps: FadedScaffoldingStep[] }) {
  const problem = steps[0]?.prompt;
  return (
    <div>
      {problem && (
        <p className="mb-5 break-words rounded-xl bg-slate-100 p-4 text-sm text-slate-800">
          <strong>Problem:</strong>{' '}
          <span className="math">
            <MathText text={problem} />
          </span>
        </p>
      )}
      <ol className="space-y-3">
        {steps.map((s) => (
          <ScaffoldStep key={s.stepNumber} step={s} />
        ))}
      </ol>
    </div>
  );
}

function ScaffoldStep({ step }: { step: FadedScaffoldingStep }) {
  const parts = step.givenContent.split(BLANK);
  const blanks = parts.length - 1;
  const [answers, setAnswers] = useState<string[]>(() => Array(blanks).fill(''));
  const [free, setFree] = useState('');
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const blanksCorrect =
    step.blankPlaceholder !== undefined && answers.every((a) => norm(a) === norm(step.blankPlaceholder!));
  const freeCorrect = norm(free) === norm(step.givenContent);
  const correct = step.scaffoldingType === 'PARTIAL_BLANK' ? blanksCorrect : freeCorrect;

  const label = {
    GIVEN: { text: 'Worked for you', cls: 'bg-slate-100 text-slate-600' },
    PARTIAL_BLANK: { text: 'Fill the blanks', cls: 'bg-indigo-100 text-indigo-700' },
    INDEPENDENT: { text: 'Your turn', cls: 'bg-violet-100 text-violet-700' },
  }[step.scaffoldingType];

  return (
    <li className="min-w-0 rounded-xl border border-slate-200 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="latex-num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {step.stepNumber}
        </span>
        <p className="min-w-0 flex-1 break-words font-medium text-slate-900">
          {step.stepNumber === 1 ? 'Set up' : <MathText text={step.prompt} />}
        </p>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${label.cls}`}>{label.text}</span>
      </div>

      <div className="mt-3 sm:pl-8">
        {step.scaffoldingType === 'GIVEN' && (
          <p className="math break-words rounded-lg bg-slate-50 p-3 text-slate-800 [overflow-wrap:anywhere]">
            <MathText text={step.givenContent} />
          </p>
        )}

        {step.scaffoldingType === 'PARTIAL_BLANK' && (
          <p className="math flex flex-wrap items-center gap-1 break-words rounded-lg bg-slate-50 p-3 text-slate-800 [overflow-wrap:anywhere]">
            {parts.map((part, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <MathText mode="math" text={part} />
                {i < blanks && (
                  <input
                    aria-label={`Blank ${i + 1}`}
                    value={answers[i]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                      setChecked(false);
                    }}
                    className={`latex-num w-12 rounded-md border px-1 py-0.5 text-center text-sm ${
                      checked
                        ? norm(answers[i]) === norm(step.blankPlaceholder ?? '')
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-rose-400 bg-rose-50'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                )}
              </span>
            ))}
          </p>
        )}

        {step.scaffoldingType === 'INDEPENDENT' && (
          <div className="space-y-2">
            <input
              aria-label="Your answer"
              value={free}
              onChange={(e) => {
                setFree(e.target.value);
                setChecked(false);
              }}
              placeholder={formatMathPlaceholder('y = a(x - h)^2 + k')}
              className="latex-math w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {free.trim() && (
              <p className="math rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                <span className="mr-2 font-sans text-xs font-medium text-slate-400">Preview:</span>
                <MathText mode="math" text={free} />
              </p>
            )}
            {revealed && (
              <p className="math rounded-lg bg-emerald-50 p-3 text-emerald-900 ring-1 ring-emerald-200">
                <MathText mode="math" text={step.givenContent} />
              </p>
            )}
          </div>
        )}

        {step.scaffoldingType !== 'GIVEN' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setChecked(true)}
              className="btn btn-sm btn-primary"
            >
              Check
            </button>
            <button
              onClick={() => setShowHint((v) => !v)}
              className="btn btn-sm btn-secondary"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {showHint ? 'Hide hint' : 'Hint'}
            </button>
            {step.scaffoldingType === 'INDEPENDENT' && (
              <button
                onClick={() => setRevealed(true)}
                className="btn btn-sm btn-secondary"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden /> Show answer
              </button>
            )}
            {checked &&
              (correct ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Nice, that&apos;s right.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                  <XCircle className="h-4 w-4" /> Not quite. Try the hint.
                </span>
              ))}
          </div>
        )}

        {(showHint || step.scaffoldingType === 'GIVEN') && (
          <p className="mt-2 text-sm text-slate-500">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
            <MathText text={step.hint} />
          </p>
        )}
      </div>
    </li>
  );
}

function IndependentTransfer({ worksheet }: { worksheet: WS_3STAGE_V1 }) {
  const t = worksheet.sectionC_IndependentTransfer;
  const [work, setWork] = useState('');
  const [checks, setChecks] = useState<boolean[]>(() => t.metacognitiveChecklist.map(() => false));
  const doneCount = checks.filter(Boolean).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            Focus: {PILLARS[t.targetPillarFocus].short}
          </span>
          <span className="text-[11px] text-slate-400">
            <MathText text={t.problemId} />
          </span>
        </div>
        <p className="mt-3 text-lg text-slate-900">
          <MathText text={t.problemStatement} />
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Your work</span>
          <textarea
            value={work}
            onChange={(e) => setWork(e.target.value)}
            rows={8}
            placeholder={formatMathPlaceholder('y = -4(x^2 - 6x) - 7\n...')}
            className="latex-math w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </label>
        {work.trim() && (
          <div className="math mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-slate-200">
            <p className="font-sans text-xs font-medium text-slate-400">LaTeX preview:</p>
            {work.split('\n').map((line, idx) => (
              <p key={idx}>
                <MathText mode="math" text={line} />
              </p>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500">Prefer paper? Solve it by hand and use Upload Work to submit a photo.</p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Self-check</h3>
          <span className="latex-math text-xs font-medium text-slate-500">
            <MathNumber value={doneCount} />/<MathNumber value={checks.length} />
          </span>
        </div>
        <ul className="mt-3 space-y-3">
          {t.metacognitiveChecklist.map((item, i) => (
            <li key={i}>
              <label className="flex cursor-pointer gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() => setChecks(checks.map((c, j) => (j === i ? !c : c)))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={checks[i] ? 'text-slate-400 line-through' : ''}>
                  <MathText text={item} />
                </span>
              </label>
            </li>
          ))}
        </ul>
        {doneCount === checks.length ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            All checks done. You&apos;re ready to submit this one.
          </p>
        ) : (
          <button
            onClick={() => setChecks(checks.map(() => false))}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
