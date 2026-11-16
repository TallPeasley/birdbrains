'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, Lightbulb, Printer, RotateCcw, Send, XCircle } from 'lucide-react';
import PillarBadge from '@/components/PillarBadge';
import SectionIndex from '@/components/aero/SectionIndex';
import { aeroBrand } from '@/lib/aero/brands';
import { AERO_URLS, BRAND_STAGE } from '@/lib/aero/stage';
import type { FadedScaffoldingStep, WS_3STAGE_V1 } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';
import { formatMathPlaceholder, MathNumber, MathText } from '@/components/MathText';

const SECTIONS = [
  { key: 'A', title: 'Diagnostic Mirror', sub: 'Your work vs. the fix' },
  { key: 'B', title: 'Faded Scaffolding', sub: 'Guided practice' },
  { key: 'C', title: 'Independent Transfer', sub: 'Try it solo + reflect' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * One-click hand-off to Chirp (the Aero daily task app): the practice drills travel in the link itself,
 * as base64url JSON after #import=. Chirp adds them to today's tasks. Nothing is sent to a server.
 */
function chirpImportUrl(worksheet: WS_3STAGE_V1): string {
  const base = (AERO_URLS.chirp || aeroBrand('chirp', BRAND_STAGE).url).replace(/\/$/, '');
  const payload = {
    v: 1,
    src: 'birdbrains',
    ref: worksheet.worksheetId,
    title: worksheet.title,
    tasks: [
      `Practice drill A: review the diagnostic mirror for ${worksheet.targetConcept}`,
      `Practice drill B: finish the ${worksheet.sectionB_FadedScaffolding.length} guided steps`,
      `Practice drill C: solve the independent problem and tick the self-check`,
    ],
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${base}/#import=${b64}`;
}

function printWorksheet() {
  document.body.dataset.print = 'worksheet';
  const done = () => {
    delete document.body.dataset.print;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

export default function WorksheetViewer({ worksheet }: { worksheet: WS_3STAGE_V1 }) {
  const [active, setActive] = useState<SectionKey>('A');

  return (
    <section className="card overflow-hidden" data-worksheet>
      <div className="border-b border-line p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow flex items-center gap-2.5">
            <SectionIndex n={4} />
            Your remedial worksheet
          </p>
          <div className="no-print flex flex-wrap gap-2">
            <a
              href={chirpImportUrl(worksheet)}
              target="_blank"
              rel="noopener"
              className="aero-btn aero-btn--sm"
              title="Add these three practice drills to today's tasks in Chirp"
            >
              <Send className="h-3.5 w-3.5" aria-hidden /> Send to Chirp
            </a>
            <button type="button" onClick={printWorksheet} className="aero-btn aero-btn--sm">
              <Printer className="h-3.5 w-3.5" aria-hidden /> Print
            </button>
          </div>
        </div>
        <h2 className="mt-2 text-xl font-bold text-slate-900">
          <MathText text={worksheet.title} />
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Target concept: <MathText text={worksheet.targetConcept} />
        </p>

        <div role="tablist" aria-label="Worksheet sections" className="no-print mt-5 grid grid-cols-3 gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              role="tab"
              id={`tab-${s.key}`}
              aria-selected={active === s.key}
              aria-controls={`panel-${s.key}`}
              onClick={() => setActive(s.key)}
              className={`-mb-px min-w-0 border-b-2 px-1.5 pb-3 text-left transition sm:px-2 ${
                active === s.key ? 'border-brand' : 'border-transparent hover:border-slate-300'
              }`}
            >
              <span className={`block font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] ${active === s.key ? 'text-brand-3' : 'text-slate-400'}`}>
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

      {/* All three panels stay mounted (answers survive a tab switch) and all three print. */}
      {SECTIONS.map((s) => (
        <div
          key={s.key}
          className={`p-4 sm:p-6 print:block print:break-inside-avoid ${active === s.key ? '' : 'hidden'}`}
          role="tabpanel"
          id={`panel-${s.key}`}
          aria-labelledby={`tab-${s.key}`}
        >
          <p className="mb-3 hidden font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 print:block">
            Section {s.key} · {s.title}
          </p>
          {s.key === 'A' && <DiagnosticMirror worksheet={worksheet} />}
          {s.key === 'B' && <FadedScaffolding steps={worksheet.sectionB_FadedScaffolding} />}
          {s.key === 'C' && <IndependentTransfer worksheet={worksheet} />}
        </div>
      ))}
    </section>
  );
}

function DiagnosticMirror({ worksheet }: { worksheet: WS_3STAGE_V1 }) {
  return (
    <div className="space-y-4">
      {worksheet.sectionA_DiagnosticMirror.map((item, i) => (
        <div key={i} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-md border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">What you wrote</p>
              <p className="math mt-3 break-words text-base text-slate-800 underline decoration-rose-400 decoration-wavy underline-offset-4 sm:text-lg [overflow-wrap:anywhere]">
                <MathText mode="math" text={item.originalStepText} />
              </p>
            </div>
            <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Annotated breakdown</p>
              <div className="math mt-3 space-y-1 break-words text-base text-slate-800 sm:text-lg [overflow-wrap:anywhere]">
                {item.annotatedCorrection.split('=>').map((line, j) => (
                  <p key={j}>
                    {j > 0 && <span className="latex-op mr-2 text-emerald-600">⇒</span>}
                    <MathText mode="math" text={line.trim()} />
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 rounded-md bg-brand-soft p-4 text-sm text-brand-3 ring-1 ring-brand-line">
            <Lightbulb className="h-5 w-5 shrink-0 text-brand-3" aria-hidden />
            <p>
              <strong>Key takeaway:</strong> <MathText text={item.keyTakeaway} />
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const BLANK = '[ __ ]';
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function FadedScaffolding({ steps }: { steps: FadedScaffoldingStep[] }) {
  const problem = steps[0]?.prompt;
  return (
    <div>
      {problem && (
        <p className="mb-5 break-words rounded-md bg-slate-100 p-4 text-sm text-slate-800">
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
    GIVEN: { text: 'Worked for you', cls: '' },
    PARTIAL_BLANK: { text: 'Fill the blanks', cls: 'aero-badge--accent' },
    INDEPENDENT: { text: 'Your turn', cls: 'aero-badge--solid' },
  }[step.scaffoldingType];

  return (
    <li className="min-w-0 rounded-md border border-line p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-sm bg-slate-900 font-mono text-[11px] font-semibold text-white">
          {String(step.stepNumber).padStart(2, '0')}
        </span>
        <p className="min-w-0 flex-1 break-words font-medium text-slate-900">
          {step.stepNumber === 1 ? 'Set up' : <MathText text={step.prompt} />}
        </p>
        <span className={`aero-badge ml-auto ${label.cls}`}>{label.text}</span>
      </div>

      <div className="mt-3 sm:pl-8">
        {step.scaffoldingType === 'GIVEN' && (
          <p className="math break-words rounded-sm bg-slate-50 p-3 text-slate-800 [overflow-wrap:anywhere]">
            <MathText text={step.givenContent} />
          </p>
        )}

        {step.scaffoldingType === 'PARTIAL_BLANK' && (
          <p className="math flex flex-wrap items-center gap-1 break-words rounded-sm bg-slate-50 p-3 text-slate-800 [overflow-wrap:anywhere]">
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
                    className={`latex-num w-12 rounded-sm border px-1 py-0.5 text-center text-sm ${
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
              className="latex-math w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
            {free.trim() && (
              <p className="math rounded-sm bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-line">
                <span className="mr-2 font-sans text-xs font-medium text-slate-400">Preview:</span>
                <MathText mode="math" text={free} />
              </p>
            )}
            {revealed && (
              <p className="math rounded-sm bg-emerald-50 p-3 text-emerald-900 ring-1 ring-emerald-200">
                <MathText mode="math" text={step.givenContent} />
              </p>
            )}
          </div>
        )}

        {step.scaffoldingType !== 'GIVEN' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setChecked(true)}
              className="rounded-sm bg-brand-3 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
            >
              Check
            </button>
            <button
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {showHint ? 'Hide hint' : 'Hint'}
            </button>
            {step.scaffoldingType === 'INDEPENDENT' && (
              <button
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-1 rounded-sm border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
          <span className="eyebrow">Focus</span>
          <PillarBadge pillar={t.targetPillarFocus} label />
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
            className="latex-math w-full rounded-md border border-slate-300 p-3 text-sm"
          />
        </label>
        {work.trim() && (
          <div className="math mt-2 space-y-1 rounded-md bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-line">
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

      <div className="rounded-lg bg-slate-50 p-5 ring-1 ring-line">
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
                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-brand-3 focus:ring-brand"
                />
                <span className={checks[i] ? 'text-slate-400 line-through' : ''}>
                  <MathText text={item} />
                </span>
              </label>
            </li>
          ))}
        </ul>
        {doneCount === checks.length ? (
          <p className="mt-4 rounded-sm bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
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
