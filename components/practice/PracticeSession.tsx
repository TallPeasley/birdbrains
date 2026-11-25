'use client';

/**
 * The practice tab: a worksheet's questions one at a time, typed answers checked on the spot, a score
 * that rises with right answers and dips with wrong ones, and a worked explanation after each miss.
 * Opened in a new tab from the worksheet (/practice?g=<gradingId>); with no id it uses the sample worksheet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Lightbulb, ListChecks, RotateCcw, Trophy, XCircle } from 'lucide-react';
import type { WS_3STAGE_V1 } from '@/types/birdBrains';
import { MathText } from '@/components/MathText';
import { BLANK, isWordy, renderKatex } from '@/lib/katexMath';
import { expectedBlanks, sameAnswer } from '@/lib/answerCheck';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { worksheet as sampleWorksheet } from '@/lib/mockData';

export interface PracticeQuestion {
  key: string;
  /** Small label above the question: "Guided step 2", "Warm-up", "Challenge". */
  tag: string;
  /** The problem the guided steps belong to, shown above them. */
  context?: string;
  /** Every step worked before this one (prompt and line), so the student sees how they connect. */
  worked?: { step: number; prompt: string; line: string }[];
  prompt: string;
  /** A line with [ __ ] boxes to fill; absent for a typed answer. */
  line?: string;
  /** One expected answer per box, or one for a typed answer. */
  expected: string[];
  /** The full right answer, shown after a miss. */
  answer: string;
  /** Worked solution (lines split by " ; ") or a hint, shown after a miss. */
  explanation?: string;
  hint?: string;
}

const DIFFICULTY_TAG = { WARM_UP: 'Warm-up', CORE: 'Core', STRETCH: 'Stretch' } as const;
const DIFFICULTY_ORDER = { WARM_UP: 0, CORE: 1, STRETCH: 2 } as const;

/** Every question a worksheet holds that has an answer to check against, guided steps first. */
export function practiceQuestions(ws: WS_3STAGE_V1): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  const steps = ws.sectionB_FadedScaffolding ?? [];
  const problem = steps[0]?.prompt;
  const worked: { step: number; prompt: string; line: string }[] = [];
  for (const s of steps) {
    const boxes = s.givenContent.split(BLANK).length - 1;
    const filled = boxes
      ? expectedBlanks(s.blankPlaceholder, boxes).reduce((line, a) => line.replace(BLANK, a), s.givenContent)
      : s.givenContent;
    if (s.scaffoldingType === 'PARTIAL_BLANK' && boxes > 0 && s.blankPlaceholder?.trim()) {
      out.push({
        key: `B${s.stepNumber}`,
        tag: `Guided step ${s.stepNumber}`,
        context: problem,
        worked: [...worked],
        prompt: s.prompt,
        line: s.givenContent,
        expected: expectedBlanks(s.blankPlaceholder, boxes),
        answer: filled,
        hint: s.hint,
      });
    } else if (s.scaffoldingType === 'INDEPENDENT' && s.givenContent.trim()) {
      out.push({
        key: `B${s.stepNumber}`,
        tag: `Guided step ${s.stepNumber}: on your own`,
        context: problem,
        worked: [...worked],
        prompt: s.prompt,
        expected: [s.givenContent],
        answer: s.givenContent,
        hint: s.hint,
      });
    }
    worked.push({ step: s.stepNumber, prompt: s.stepNumber === 1 ? 'Set up' : s.prompt, line: filled });
  }
  const practice = [...(ws.sectionD_PracticeSet ?? [])].sort(
    (a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1) || a.number - b.number,
  );
  for (const p of practice) {
    if (!p.answer?.trim()) continue;
    out.push({
      key: `D${p.number}`,
      tag: DIFFICULTY_TAG[p.difficulty] ?? 'Core',
      prompt: p.problemStatement,
      expected: [p.answer],
      answer: p.answer,
      explanation: p.workedSolution,
    });
  }
  const c = ws.sectionC_IndependentTransfer;
  if (c?.answer?.trim()) {
    out.push({
      key: 'C',
      tag: 'Challenge',
      prompt: c.problemStatement,
      expected: [c.answer],
      answer: c.answer,
      explanation: c.workedSolution,
    });
  }
  return out;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'signin' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; worksheet: WS_3STAGE_V1; sample: boolean };

export default function PracticeSession() {
  const params = useSearchParams();
  const gradingId = params.get('g');
  const { live, ready, signedIn, getToken } = useSession();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    if (!live || !gradingId) {
      setLoad({ kind: 'ready', worksheet: sampleWorksheet, sample: true });
      return;
    }
    if (!ready) return;
    if (!signedIn) {
      setLoad({ kind: 'signin' });
      return;
    }
    let cancelled = false;
    (async () => {
      const ws = await api.worksheet(await getToken(), gradingId);
      if (!cancelled) setLoad({ kind: 'ready', worksheet: ws, sample: false });
    })().catch((err) => {
      if (cancelled) return;
      const message =
        err instanceof ApiError && err.status === 404
          ? 'This practice worksheet is not ready yet. Go back to your dashboard and make it first.'
          : 'The worksheet could not be loaded. Check your connection and reload this tab.';
      setLoad({ kind: 'error', message });
    });
    return () => {
      cancelled = true;
    };
  }, [live, gradingId, ready, signedIn, getToken]);

  if (load.kind === 'loading') return <Notice text="Loading your practice…" />;
  if (load.kind === 'signin')
    return (
      <Notice text="Sign in to practise this worksheet.">
        <a href="/account" className="btn btn-primary mt-4">
          Sign in
        </a>
      </Notice>
    );
  if (load.kind === 'error') return <Notice text={load.message} />;
  return <Player worksheet={load.worksheet} sample={load.sample} />;
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-slate-700">{text}</p>
      {children}
    </div>
  );
}

type Phase = 'ask' | 'right' | 'wrong' | 'done';

function formatTime(seconds: number): { mm: string; ss: string; hh: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { hh: pad(Math.floor(seconds / 3600)), mm: pad(Math.floor(seconds / 60) % 60), ss: pad(seconds % 60) };
}

export function Player({ worksheet, sample }: { worksheet: WS_3STAGE_V1; sample: boolean }) {
  const questions = useMemo(() => practiceQuestions(worksheet), [worksheet]);
  const total = questions.length;
  const gain = total ? Math.ceil(100 / total) : 100;

  // A queue of question indexes; a missed question comes back once at the end.
  const [queue, setQueue] = useState<number[]>(() => questions.map((_, i) => i));
  const [retried, setRetried] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>(total ? 'ask' : 'done');
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [showHint, setShowHint] = useState(false);
  // Bumped for every new question shown, even when a retry repeats the same one.
  const [turn, setTurn] = useState(0);
  const firstInput = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  const current = queue[0];
  const q = current !== undefined ? questions[current] : undefined;
  const boxes = q?.line ? q.expected.length : 1;

  useEffect(() => {
    if (phase === 'done') return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    setAnswers(Array(boxes).fill(''));
    setShowHint(false);
  }, [turn, boxes]);

  useEffect(() => {
    if (phase === 'ask') firstInput.current?.focus();
    else if (phase === 'right' || phase === 'wrong') nextButton.current?.focus();
  }, [phase, turn]);

  const next = useCallback(() => {
    const rest = queue.slice(1);
    setQueue(rest);
    setTurn((t) => t + 1);
    setPhase(rest.length ? 'ask' : 'done');
  }, [queue]);

  // A right answer moves on by itself after a moment.
  useEffect(() => {
    if (phase !== 'right') return;
    const t = window.setTimeout(next, 1200);
    return () => window.clearTimeout(t);
  }, [phase, next]);

  function submit() {
    if (!q || phase !== 'ask' || answers.every((a) => !a.trim())) return;
    const right = q.expected.every((e, k) => sameAnswer(answers[k] ?? '', e));
    setAnswered((n) => n + 1);
    const again = retried.has(current);
    if (right) {
      setScore((s) => Math.min(100, s + (again ? Math.ceil(gain / 2) : gain)));
      setPhase('right');
    } else {
      setScore((s) => Math.max(0, s - Math.ceil(gain / 2)));
      setMissed((m) => new Set(m).add(current));
      if (!again) {
        setRetried((r) => new Set(r).add(current));
        setQueue((qs) => [...qs, current]);
      }
      setPhase('wrong');
    }
  }

  function restart() {
    setQueue(questions.map((_, i) => i));
    setRetried(new Set());
    setMissed(new Set());
    setScore(0);
    setAnswered(0);
    setSeconds(0);
    setTurn((t) => t + 1);
    setPhase(total ? 'ask' : 'done');
  }

  const time = formatTime(seconds);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{sample ? 'Sample practice' : 'Practice'}</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
            <MathText text={worksheet.title} />
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <MathText text={worksheet.targetConcept} />
          </p>
        </div>
        {phase !== 'done' && (
          <p className="text-sm text-slate-500">
            <span className="latex-num font-semibold text-slate-700">{queue.length}</span> {queue.length === 1 ? 'question' : 'questions'} left
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
        {/* Stats: a strip on phones, a side panel on wide screens. */}
        <aside className="order-first grid grid-cols-3 gap-2 lg:order-last lg:grid-cols-1 lg:content-start" aria-label="Progress">
          <Stat label="Questions answered" short="Answered" icon={<ListChecks className="h-4 w-4" aria-hidden />}>
            <span className="latex-num text-2xl font-bold text-slate-900 lg:text-3xl">{answered}</span>
          </Stat>
          <Stat label="Time elapsed" short="Time" icon={<Clock className="h-4 w-4" aria-hidden />}>
            <span className="latex-num text-lg font-bold text-slate-900 lg:text-2xl" aria-label={`${time.mm} minutes ${time.ss} seconds`}>
              {seconds >= 3600 ? `${time.hh}:` : ''}
              {time.mm}:{time.ss}
            </span>
          </Stat>
          <Stat label="Score" icon={<Trophy className="h-4 w-4" aria-hidden />}>
            <span className="latex-num text-2xl font-bold text-indigo-700 lg:text-3xl">{score}</span>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
              aria-label="Score out of 100"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${score >= 90 ? 'bg-emerald-500' : score >= 50 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </Stat>
        </aside>

        <section className="card min-w-0 p-5 sm:p-8" aria-live="polite">
          {phase === 'done' || !q ? (
            <Finished
              total={total}
              score={score}
              answered={answered}
              missed={missed.size}
              time={`${seconds >= 3600 ? `${time.hh}:` : ''}${time.mm}:${time.ss}`}
              onRestart={restart}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                  {q.tag}
                </span>
                {retried.has(current) && phase === 'ask' && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    Try this one again
                  </span>
                )}
              </div>

              {q.context && (
                <p className="mt-4 break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-semibold">Problem: </span>
                  <MathText text={q.context} />
                </p>
              )}
              {q.worked && q.worked.length > 0 && (
                <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4" aria-label="Steps so far">
                  {q.worked.map((w) => (
                    <li key={w.step} className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        Step {w.step}: <MathText text={w.prompt} />
                      </p>
                      <div className="mt-0.5 overflow-x-auto text-slate-800">
                        <WorkedLine line={w.line} />
                      </div>
                    </li>
                  ))}
                  <li className="text-xs font-semibold text-indigo-700">Step {(q.worked.at(-1)?.step ?? 0) + 1}: your turn ↓</li>
                </ol>
              )}

              <p className="mt-5 break-words text-lg text-slate-900 sm:text-xl">
                <MathText text={q.prompt} />
              </p>

              {q.line && (
                <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4">
                  <Line content={q.line} />
                </div>
              )}

              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="flex flex-wrap items-end gap-3">
                  {answers.map((a, k) => (
                    <label key={k} className={`flex flex-col gap-1 text-sm text-slate-600 ${q.line ? '' : 'w-full'}`}>
                      {q.line && boxes > 1 && <span className="latex-num text-xs font-semibold">Box {k + 1}</span>}
                      <input
                        ref={k === 0 ? firstInput : undefined}
                        aria-label={q.line ? `Box ${k + 1}` : 'Your answer'}
                        value={a}
                        readOnly={phase !== 'ask'}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={(e) => {
                          const v = [...answers];
                          v[k] = e.target.value;
                          setAnswers(v);
                        }}
                        placeholder={q.line ? '?' : 'Type your answer'}
                        className={`latex-num rounded-lg border-2 px-3 py-2 text-lg outline-none focus:border-indigo-500 ${
                          q.line ? 'w-28 text-center' : 'w-full'
                        } ${
                          phase === 'right'
                            ? 'border-emerald-400 bg-emerald-50'
                            : phase === 'wrong'
                              ? 'border-rose-400 bg-rose-50'
                              : 'border-slate-300 bg-white'
                        }`}
                      />
                    </label>
                  ))}
                </div>

                {!q.line && answers[0]?.trim() && phase === 'ask' && (
                  <p className="mt-2 text-sm text-slate-500">
                    Reads as: <MathText mode="math" text={answers[0]} />
                  </p>
                )}

                {phase === 'ask' && (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="submit" className="btn btn-primary px-6" disabled={answers.every((a) => !a.trim())}>
                      Submit
                    </button>
                    {q.hint && (
                      <button type="button" className="btn btn-sm btn-link" onClick={() => setShowHint((v) => !v)}>
                        <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> {showHint ? 'Hide hint' : 'Need a hint?'}
                      </button>
                    )}
                  </div>
                )}
                {phase === 'ask' && (
                  <p className="mt-3 text-xs text-slate-400">
                    Type maths as plain text: x^2 for a power, sqrt(9) for a square root, 3/4 for a fraction. List two answers with a comma.
                  </p>
                )}
                {showHint && phase === 'ask' && q.hint && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                    <MathText text={q.hint} />
                  </p>
                )}
              </form>

              {phase === 'right' && (
                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
                  <p className="text-lg font-semibold text-emerald-800">Correct! Nice work.</p>
                  <button ref={nextButton} onClick={next} className="btn btn-sm btn-secondary ml-auto">
                    Next
                  </button>
                </div>
              )}

              {phase === 'wrong' && (
                <div className="mt-6 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200 sm:p-5">
                  <p className="flex items-center gap-2 text-lg font-semibold text-rose-800">
                    <XCircle className="h-6 w-6" aria-hidden /> Sorry, incorrect.
                  </p>
                  <dl className="mt-3 space-y-3 text-slate-800">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">The correct answer is</dt>
                      <dd className="mt-1 overflow-x-auto text-lg">
                        <MathText mode="math" text={q.answer} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">You answered</dt>
                      <dd className="mt-1 overflow-x-auto">
                        <MathText mode="math" text={answers.filter((a) => a.trim()).join(', ') || '(blank)'} />
                      </dd>
                    </div>
                    {(q.explanation || q.hint) && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</dt>
                        <dd className="mt-1 space-y-1">
                          {(q.explanation || q.hint || '')
                            .split(/\s;\s|\n/)
                            .filter((l) => l.trim())
                            .map((l, i) => (
                              <p key={i}>
                                <MathText text={l.trim()} />
                              </p>
                            ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {queue.slice(1).includes(current) && (
                    <p className="mt-3 text-sm text-slate-600">This one comes back at the end for another try.</p>
                  )}
                  <button ref={nextButton} onClick={next} className="btn btn-primary mt-4">
                    Got it
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, short, icon, children }: { label: string; short?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-3 lg:p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        <span className="truncate lg:hidden">{short ?? label}</span>
        <span className="hidden truncate lg:inline">{label}</span>
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** A worked line: "Group and factor out 3: y = ..." keeps its words as text and typesets the maths. */
function WorkedLine({ line }: { line: string }) {
  const at = line.lastIndexOf(':');
  const label = at > 0 && /[A-Za-z]{3,}/.test(line.slice(0, at)) ? line.slice(0, at + 1) : '';
  const maths = label ? line.slice(at + 1).trim() : line;
  if (isWordy(maths)) return <MathText text={line} />; // "Step 1: Group and factor out 3 -> y = ..."
  const html = renderKatex(maths);
  return (
    <>
      {label && <span className="mr-1 text-sm text-slate-600">{label}</span>}
      {html ? <span className="bb-katex text-base" dangerouslySetInnerHTML={{ __html: html }} /> : <MathText mode="math" text={maths} />}
    </>
  );
}

/** The step's line typeset whole, with numbered boxes where the blanks are. */
function Line({ content }: { content: string }) {
  const html = renderKatex(content, true);
  if (html) return <span className="bb-katex text-xl" dangerouslySetInnerHTML={{ __html: html }} />;
  return <MathText mode="math" text={content.split(BLANK).join(' ▢ ')} />;
}

function Finished({
  total,
  score,
  answered,
  missed,
  time,
  onRestart,
}: {
  total: number;
  score: number;
  answered: number;
  missed: number;
  time: string;
  onRestart: () => void;
}) {
  if (total === 0)
    return (
      <div className="py-8 text-center">
        <p className="text-slate-700">This worksheet has no questions with answers to check yet.</p>
        <p className="mt-1 text-sm text-slate-500">Use the worksheet on your dashboard, or make it again for a full practice set.</p>
      </div>
    );
  return (
    <div className="py-6 text-center">
      <Trophy className="mx-auto h-12 w-12 text-amber-500" aria-hidden />
      <h2 className="mt-3 text-2xl font-semibold text-slate-900">You finished the practice!</h2>
      <p className="mt-2 text-slate-600">
        Score <strong className="latex-num">{score}</strong> · {answered} answers in {time}
        {missed > 0 ? ` · ${missed} to review` : ' · no misses'}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {score >= 90 ? 'You have this skill. Try a new upload next.' : 'Go again to lock it in; the questions you missed are worth another look.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onRestart} className="btn btn-primary">
          <RotateCcw className="h-4 w-4" aria-hidden /> Practise again
        </button>
        <a href="/student" className="btn btn-secondary">
          Back to my dashboard
        </a>
      </div>
    </div>
  );
}
