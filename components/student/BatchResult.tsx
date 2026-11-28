'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, Lightbulb, Presentation } from 'lucide-react';
import { MathText } from '@/components/MathText';
import type { ApiBatch, ApiPracticeProblem, ApiTextbookProblem, BatchMode } from '@/types/birdBrains';

const DIFFICULTY: Record<ApiPracticeProblem['difficulty'], { label: string; cls: string }> = {
  WARM_UP: { label: 'Warm-up', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CORE: { label: 'Core', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  STRETCH: { label: 'Stretch', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

/** A finished slides or textbook batch: the practice set, or the hints per problem. */
export default function BatchResult({ batch }: { batch: ApiBatch }) {
  if (batch.uploadMode === 'SLIDES_DECK' && batch.practice) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            <MathText text={batch.practice.title} />
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            <MathText text={batch.practice.summary} />
          </p>
        </div>
        <ol className="space-y-2">
          {batch.practice.problems.map((p) => (
            <PracticeRow key={p.number} problem={p} />
          ))}
        </ol>
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {batch.textbookHints.map((p) => (
        <HintRow key={p.label} problem={p} />
      ))}
    </ol>
  );
}

function PracticeRow({ problem }: { problem: ApiPracticeProblem }) {
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState(false);
  const d = DIFFICULTY[problem.difficulty];
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 font-mono text-xs font-semibold text-slate-500">{problem.number}.</span>
        <p className="min-w-0 flex-1 text-sm text-slate-900">
          <MathText text={problem.prompt} />
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${d.cls}`}>{d.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-5">
        <button type="button" onClick={() => setHint((v) => !v)} aria-expanded={hint} className="btn btn-sm btn-secondary">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {hint ? 'Hide hint' : 'Hint'}
        </button>
        <button type="button" onClick={() => setAnswer((v) => !v)} aria-expanded={answer} className="btn btn-sm btn-secondary">
          {answer ? 'Hide answer' : 'Check answer'}
        </button>
      </div>
      {hint && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 pl-5 text-sm text-amber-900">
          <MathText text={problem.hint} />
        </p>
      )}
      {answer && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 pl-5 text-sm font-medium text-emerald-800">
          <MathText text={problem.answer} />
        </p>
      )}
    </li>
  );
}

/** Hints open one at a time, so the student tries each step before the next. */
function HintRow({ problem }: { problem: ApiTextbookProblem }) {
  const [shown, setShown] = useState(0);
  const all = shown >= problem.hints.length;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm text-slate-900">
        <span className="mr-1.5 font-mono text-xs font-semibold text-slate-500">{problem.label}</span>
        <MathText text={problem.statement} />
      </p>
      {shown > 0 && (
        <ol className="mt-2 space-y-1.5">
          {problem.hints.slice(0, shown).map((h, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-semibold">Hint {i + 1}</span>
              <span className="min-w-0">
                <MathText text={h} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {all && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Check your answer: </span>
          <MathText text={problem.check} />
        </p>
      )}
      {!all && (
        <button type="button" onClick={() => setShown((n) => n + 1)} className="btn btn-sm btn-secondary mt-2">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          {shown === 0 ? 'Show a hint' : `Next hint (${shown + 1} of ${problem.hints.length})`}
        </button>
      )}
    </li>
  );
}

/** One line per batch in the history, opening its result. */
export function BatchHistoryItem({ batch }: { batch: ApiBatch }) {
  const [open, setOpen] = useState(false);
  const slides = batch.uploadMode === 'SLIDES_DECK';
  const Icon = slides ? Presentation : BookOpen;
  const ready = batch.status === 'READY';
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => ready && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!ready}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{batch.unitTopic}</span>
          <span className="block text-xs text-slate-500">
            {slides ? 'Practice from slides' : 'Textbook hints'} · {batch.files.length} file
            {batch.files.length === 1 ? '' : 's'} ·{' '}
            {ready ? formatDay(batch.uploadedAt) : batch.status === 'FAILED' ? 'could not be read' : 'in progress'}
          </span>
        </span>
        {ready && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden />}
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3">
          <BatchResult batch={batch} />
        </div>
      )}
    </li>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Sample results for demo mode and the How it works page. */
export function demoBatch(mode: BatchMode, topic: string, fileCount: number): ApiBatch {
  const base = {
    batchId: 'bat_demo00000001',
    studentId: 'stu_alexmercer99',
    uploadMode: mode,
    course: 'MPM2D',
    unitTopic: topic || (mode === 'SLIDES_DECK' ? 'Quadratic relations' : 'Linear systems'),
    status: 'READY' as const,
    files: Array.from({ length: Math.max(1, fileCount) }, (_, i) => ({
      name: `${mode === 'SLIDES_DECK' ? 'slides' : 'page'}-${i + 1}.pdf`,
      mimeType: 'application/pdf',
      bytes: 420_000,
    })),
    uploadedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    textbookHints: [],
  };
  if (mode === 'SLIDES_DECK') {
    return {
      ...base,
      practice: {
        title: 'Practice: factoring quadratics',
        summary: 'The slides show how to factor x^2 + bx + c by finding two numbers that multiply to c and add to b.',
        problems: [
          { number: '1', prompt: 'Factor x^2 + 5x + 6.', answer: '(x + 2)(x + 3)', hint: 'Which two numbers multiply to 6 and add to 5?', difficulty: 'WARM_UP' },
          { number: '2', prompt: 'Factor x^2 - x - 12.', answer: '(x - 4)(x + 3)', hint: 'The product is negative, so the two numbers have opposite signs.', difficulty: 'CORE' },
          { number: '3', prompt: 'Factor 2x^2 + 7x + 3.', answer: '(2x + 1)(x + 3)', hint: 'Look for numbers that multiply to 2 × 3 = 6 and add to 7.', difficulty: 'STRETCH' },
        ],
      },
    };
  }
  return {
    ...base,
    practice: null,
    textbookHints: [
      {
        label: '4',
        statement: 'Solve the system x + y = 10 and x - y = 4.',
        hints: [
          'Both equations have a y with opposite signs.',
          'Add the two equations to eliminate y.',
          'You get 2x = 14. Solve for x, then substitute back to find y.',
        ],
        check: 'Substitute your x and y into BOTH original equations.',
      },
      {
        label: '5',
        statement: 'Solve 2x + 3y = 12 and x - y = 1.',
        hints: [
          'Rearrange the second equation so x is on its own.',
          'Substitute x = y + 1 into the first equation.',
          'Solve 2(y + 1) + 3y = 12 for y.',
        ],
        check: 'Both equations should be true with your values.',
      },
    ],
  };
}
