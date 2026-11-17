'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Eye, Lightbulb, Loader2, Printer, RotateCcw, XCircle } from 'lucide-react';
import type { FadedScaffoldingStep, WS_3STAGE_V1 } from '@/types/birdBrains';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { PILLARS } from '@/lib/pillars';
import { formatMathPlaceholder, MathNumber, MathText } from '@/components/MathText';

const SECTIONS = [
  { key: 'A', title: 'Diagnostic Mirror', sub: 'Your work vs. the fix' },
  { key: 'B', title: 'Faded Scaffolding', sub: 'Guided practice' },
  { key: 'C', title: 'Independent Transfer', sub: 'Try it solo + reflect' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function WorksheetViewer({ worksheet }: { worksheet: WS_3STAGE_V1 }) {
  const { live, getToken } = useSession();
  const [active, setActive] = useState<SectionKey>('A');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNotice, setPdfNotice] = useState('');

  async function handleDownloadPdf() {
    setPdfNotice('');
    if (!live) {
      setPdfNotice('Demo mode: opening print view for PDF export.');
      window.print();
      return;
    }
    setPdfBusy(true);
    try {
      const token = await getToken();
      const blob = await api.worksheetPdf(token, worksheet.gradingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${worksheet.worksheetId || 'birdbrains-worksheet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfNotice(err instanceof Error ? err.message : 'PDF is not available yet. You can print this page instead.');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="no-print border-b border-slate-200 p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Your remedial worksheet</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              <MathText text={worksheet.title} />
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Target concept: <MathText text={worksheet.targetConcept} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              Download PDF
            </button>
          </div>
        </div>
        {pdfNotice && (
          <p role="status" className="mt-2 text-xs font-medium text-amber-800">
            {pdfNotice}
          </p>
        )}

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

      <div className="no-print p-4 sm:p-6" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === 'A' && <DiagnosticMirror worksheet={worksheet} />}
        {active === 'B' && <FadedScaffolding steps={worksheet.sectionB_FadedScaffolding} />}
        {active === 'C' && <IndependentTransfer worksheet={worksheet} />}
      </div>

      {/* Print-only 3-stage layout */}
      <div className="hidden space-y-6 p-2 print:block">
        <div className="border-b-2 border-slate-900 pb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">BirdBrains · 3-Stage Practice Worksheet</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            <MathText text={worksheet.title} />
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Target concept: <MathText text={worksheet.targetConcept} />
          </p>
        </div>

        <div className="print-avoid-break space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Section A · Diagnostic Mirror</h3>
          <DiagnosticMirror worksheet={worksheet} />
        </div>

        <div className="print-avoid-break space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Section B · Faded Scaffolding</h3>
          {worksheet.sectionB_FadedScaffolding[0]?.prompt && (
            <p className="rounded-lg border border-slate-300 p-3 text-sm">
              <strong>Problem:</strong> <MathText text={worksheet.sectionB_FadedScaffolding[0].prompt} />
            </p>
          )}
          <ol className="space-y-3">
            {worksheet.sectionB_FadedScaffolding.map((step) => (
              <li key={step.stepNumber} className="rounded-lg border border-slate-300 p-3 text-sm">
                <p className="font-semibold">
                  Step {step.stepNumber}: {step.stepNumber === 1 ? 'Set up' : <MathText text={step.prompt} />}
                </p>
                {step.scaffoldingType === 'INDEPENDENT' ? (
                  <div className="mt-3 space-y-4">
                    <div className="h-6 border-b border-dashed border-slate-400" />
                    <div className="h-6 border-b border-dashed border-slate-400" />
                  </div>
                ) : (
                  <p className="math mt-2">
                    <MathText text={step.givenContent.replaceAll(BLANK, ' [ ________ ] ')} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="print-avoid-break space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Section C · Independent Transfer</h3>
          <p className="rounded-lg border border-slate-300 p-3 text-sm font-medium">
            <MathText text={worksheet.sectionC_IndependentTransfer.problemStatement} />
          </p>
          <div className="h-44 rounded-lg border border-slate-300 p-2 text-xs text-slate-400">Show your full solution here:</div>
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Self-Check</p>
            {worksheet.sectionC_IndependentTransfer.metacognitiveChecklist.map((item, idx) => (
              <p key={idx} className="flex items-center gap-2 text-xs text-slate-800">
                <span className="inline-block h-3.5 w-3.5 border border-slate-700" />
                <MathText text={item} />
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagnosticMirror({ worksheet }: { worksheet: WS_3STAGE_V1 }) {
  return (
    <div className="space-y-4">
      {worksheet.sectionA_DiagnosticMirror.map((item, i) => (
        <div key={i} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">What you wrote</p>
              <p className="math mt-3 break-words text-base text-slate-800 underline decoration-rose-400 decoration-wavy underline-offset-4 sm:text-lg [overflow-wrap:anywhere]">
                <MathText mode="math" text={item.originalStepText} />
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
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
          <div className="flex gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900 ring-1 ring-indigo-200">
            <Lightbulb className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
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
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Check
            </button>
            <button
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {showHint ? 'Hide hint' : 'Hint'}
            </button>
            {step.scaffoldingType === 'INDEPENDENT' && (
              <button
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
