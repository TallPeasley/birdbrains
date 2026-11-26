'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Camera, History, Layers, RefreshCw, Smartphone, Sparkles, UploadCloud } from 'lucide-react';
import PhoneQrPanel from '@/components/PhoneQrPanel';
import { useRole } from '@/lib/roleContext';
import AffectCard from '@/components/student/AffectCard';
import PillarCards from '@/components/student/PillarCards';
import StepDiagnostics from '@/components/student/StepDiagnostics';
import WorksheetViewer from '@/components/student/WorksheetViewer';
import { QuirkCollection, QuirksEarned, firstTimeQuirks } from '@/components/student/Quirks';
import { countQuirks } from '@/lib/quirks';
import MakeWorksheetButton, { MAKEABLE } from '@/components/student/MakeWorksheetButton';
import { LoadError, Loading, NoWorkNotice, useDashboardGate } from '@/components/DashboardStates';
import {
  DEMO_FREE_USAGE,
  DEMO_PRO_USAGE,
  LockedProCard,
  UploadsLeftMeter,
} from '@/components/PlanUsageBanner';
import { api, ApiError } from '@/lib/api';
import { demoPersonas, gradingOutput, worksheet as demoWorksheet } from '@/lib/mockData';
import { useSession } from '@/lib/session';
import type { ApiUsage, PlanTier, QuirkCount, Stage2GradingAndAffectOutput, WS_3STAGE_V1 } from '@/types/birdBrains';

const WORKSHEET_NOTES: Record<string, string> = {
  WORKSHEET_QUEUED: 'Your practice worksheet is ready to be made. Make it now, or it will be waiting for you tomorrow morning.',
  WORKSHEET_PENDING: 'Your practice worksheet is in tonight’s batch. Make it now if you don’t want to wait.',
  WORKSHEET_NOT_NEEDED: 'No mistakes to practise from this one. No worksheet needed!',
  WORKSHEET_FAILED: 'The last try at this worksheet did not pass our checks. Try making it again.',
};

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; usage: ApiUsage | null }
  | { kind: 'error'; message: string }
  | { kind: 'data'; history: Stage2GradingAndAffectOutput[]; usage: ApiUsage | null };

interface WorksheetState {
  gradingId: string;
  worksheet: WS_3STAGE_V1 | null;
  note: string;
  proOnly: boolean;
  /** Not made yet, and the student can make it now instead of overnight. */
  canMake?: boolean;
}

export default function StudentDashboard() {
  const { live, profile, activeStudentId, getToken, dataVersion } = useSession();
  const gate = useDashboardGate('student');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ws, setWs] = useState<WorksheetState | null>(null);
  const [recheck, setRecheck] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  // "Add photos of this page" from a phone: the QR code is shown inline.
  const [addByPhone, setAddByPhone] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const [adding, setAdding] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  const [quirkRows, setQuirkRows] = useState<QuirkCount[] | null>(null);
  const addInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!live || !activeStudentId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const token = await getToken();
      const usagePromise = api.usage(token, activeStudentId).catch(() => null);
      const quirksPromise = api.quirks(token, activeStudentId).catch(() => null);
      const history = await api.gradings(token, activeStudentId);
      const usage = await usagePromise;
      const quirks = await quirksPromise;
      if (cancelled) return;
      // Lifetime counts from the API; if that fails, count the uploads loaded here.
      setQuirkRows(quirks ?? countQuirks(history));
      if (history.length === 0) {
        setState({ kind: 'empty', usage });
        return;
      }
      setState({ kind: 'data', history, usage });
      // A new upload opens by itself; otherwise keep the one being looked at.
      const fresh = known.current.size > 0 && !known.current.has(history[0].gradingId);
      known.current = new Set(history.map((g) => g.gradingId));
      setSelectedId((id) => (!fresh && id && known.current.has(id) ? id : history[0].gradingId));
    })().catch((err) => {
      if (cancelled) return;
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

  // The practice worksheet of whichever upload is open.
  useEffect(() => {
    if (!live || !selectedId) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const next: WorksheetState = { gradingId: selectedId, worksheet: null, note: '', proOnly: false };
      try {
        next.worksheet = await api.worksheet(token, selectedId);
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        if (err.detail === 'WORKSHEET_PRO_ONLY') next.proOnly = true;
        else {
          next.note = WORKSHEET_NOTES[err.detail] ?? WORKSHEET_NOTES.WORKSHEET_QUEUED;
          next.canMake = MAKEABLE.has(err.detail.replace(/^WORKSHEET_/, ''));
        }
      }
      if (!cancelled) setWs(next);
    })().catch(() => {
      if (!cancelled) setWs({ gradingId: selectedId, worksheet: null, note: WORKSHEET_NOTES.WORKSHEET_FAILED, proOnly: false });
    });
    return () => {
      cancelled = true;
    };
  }, [live, selectedId, getToken]);

  if (!live) {
    return (
      <View
        name={demoPersonas.student.name}
        own
        grading={gradingOutput}
        worksheet={demoWorksheet}
        worksheetNote=""
        worksheetProOnly={false}
        usage={DEMO_PRO_USAGE}
        quirkRows={countQuirks([gradingOutput])}
      />
    );
  }
  if (gate) return gate;
  if (state.kind === 'loading') return <Loading variant="student" />;
  if (state.kind === 'empty') {
    return (
      <div className="space-y-6">
        {state.usage && <UploadsLeftMeter usage={state.usage} />}
        <NoWorkNotice />
      </div>
    );
  }
  if (state.kind === 'error') {
    return <LoadError title="We couldn’t load your results" message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const grading = state.history.find((g) => g.gradingId === selectedId) ?? state.history[0];
  const sheet = ws && ws.gradingId === grading.gradingId ? ws : null;

  const runRecheck = async () => {
    setRecheck({ busy: true, error: '' });
    try {
      const token = await getToken();
      const out = await api.regrade(token, grading.submissionId);
      if (out.grading) setSelectedId(out.grading.gradingId);
      setRecheck({ busy: false, error: out.grading ? '' : 'The photo could not be read this time.' });
      setAttempt((n) => n + 1);
    } catch (err) {
      setRecheck({ busy: false, error: err instanceof Error ? err.message : 'The re-check failed.' });
    }
  };

  const addPhotos = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (addInput.current) addInput.current.value = '';
    if (!files.length) return;
    setAdding({ busy: true, error: '' });
    try {
      const token = await getToken();
      const out = await api.addPhotos(token, grading.submissionId, files);
      if (out.grading) setSelectedId(out.grading.gradingId);
      setAdding({ busy: false, error: out.grading ? '' : 'The photos could not be read. Try a closer, flatter shot.' });
      setAttempt((n) => n + 1);
    } catch (err) {
      setAdding({ busy: false, error: err instanceof Error ? err.message : 'Adding the photos failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <UploadHistory history={state.history} selectedId={grading.gradingId} onSelect={setSelectedId} />
      {profile?.role === 'student' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-800">Something read wrong?</p>
            <p className="text-slate-600">
              Add another photo of the same page, or close-ups of single questions. We read them all together
              and update this result. It doesn’t use another upload.
            </p>
          </div>
          <input
            ref={addInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <button onClick={() => addInput.current?.click()} disabled={adding.busy} className="btn btn-sm btn-secondary">
            <Camera className={`h-4 w-4 ${adding.busy ? 'animate-pulse' : ''}`} aria-hidden />
            {adding.busy ? 'Reading all photos… (about a minute)' : 'Add photos of this page'}
          </button>
          <button
            onClick={() => setAddByPhone((v) => !v)}
            aria-expanded={addByPhone}
            className="btn btn-sm btn-secondary hidden [@media(pointer:fine)]:inline-flex"
          >
            <Smartphone className="h-4 w-4" aria-hidden /> {addByPhone ? 'Hide phone code' : 'Use my phone'}
          </button>
          {adding.error && <span className="w-full text-rose-700">{adding.error}</span>}
          {addByPhone && (
            <div className="w-full rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <PhoneQrPanel
                compact
                request={{ kind: 'addPhotos', submissionId: grading.submissionId }}
                onUpdate={(s) => {
                  if (s.state === 'PROCESSING') setAdding({ busy: true, error: '' });
                  else if (s.state === 'DONE' || s.state === 'FAILED' || s.state === 'NEEDS_RETAKE') {
                    setAdding({ busy: false, error: s.state === 'DONE' ? '' : 'The photos could not be read. Try a closer, flatter shot.' });
                    setAddByPhone(false);
                    setAttempt((n) => n + 1);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
      {profile?.tester && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm">
          <span className="font-medium text-slate-700">Test account</span>
          <button onClick={runRecheck} disabled={recheck.busy} className="btn btn-sm btn-secondary">
            <RefreshCw className={`h-4 w-4 ${recheck.busy ? 'animate-spin' : ''}`} aria-hidden />
            {recheck.busy ? 'Re-checking… (about a minute)' : 'Re-check this upload with the latest grader'}
          </button>
          {recheck.error && <span className="text-rose-700">{recheck.error}</span>}
        </div>
      )}
      <View
        name={profile!.name}
        own={profile!.role === 'student'}
        latest={grading.gradingId === state.history[0].gradingId}
        grading={grading}
        worksheet={sheet?.worksheet ?? null}
        worksheetNote={sheet ? sheet.note : 'Loading the practice worksheet…'}
        worksheetProOnly={sheet?.proOnly ?? false}
        onWorksheetMade={
          sheet?.canMake
            ? (made) => {
                setWs({ gradingId: sheet.gradingId, worksheet: made, note: '', proOnly: false });
                // Show it straight away: it opens at the bottom of the page, below the diagnostic.
                window.setTimeout(
                  () => document.getElementById('practice-worksheet')?.scrollIntoView({ behavior: 'smooth' }),
                  100,
                );
              }
            : undefined
        }
        usage={state.usage}
        quirkRows={quirkRows ?? countQuirks(state.history)}
        newQuirks={firstTimeQuirks(state.history, grading.gradingId)}
      />
    </div>
  );
}

/** Every graded upload, newest first. Picking one shows its results below. */
function UploadHistory({
  history,
  selectedId,
  onSelect,
}: {
  history: Stage2GradingAndAffectOutput[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (history.length < 2) return null;
  const shown = open ? history : history.slice(0, 4);
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="history-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <History className="h-5 w-5 text-indigo-600" aria-hidden /> Your uploads
        </h2>
        <span className="text-sm text-slate-500">{history.length} graded</span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {shown.map((g) => {
          const active = g.gradingId === selectedId;
          const pct = g.maxPossibleScore ? Math.round((g.totalScore / g.maxPossibleScore) * 100) : 0;
          const questions = g.questionAnalyses?.length || g.questions?.length || 1;
          return (
            <li key={g.gradingId}>
              <button
                onClick={() => onSelect(g.gradingId)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                  active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{g.topic || 'Untitled upload'}</span>
                  <span className="block text-xs text-slate-500">
                    {formatWhen(g.gradedAt)} · {questions} question{questions === 1 ? '' : 's'}
                  </span>
                </span>
                <span
                  className={`latex-num shrink-0 rounded-lg px-2 py-1 text-sm font-bold ${
                    pct >= 80 ? 'bg-emerald-100 text-emerald-800' : pct >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {pct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {history.length > 4 && (
        <button onClick={() => setOpen((v) => !v)} className="btn btn-link btn-sm mt-2">
          {open ? 'Show fewer' : `Show all ${history.length}`}
        </button>
      )}
    </section>
  );
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * The sample student (Alex) on the How it works page. Pure mock data, no session or API calls,
 * so it behaves the same on every build. The plan switch shows what Free and Pro each include.
 */
export function StudentDemo({ plan }: { plan: PlanTier }) {
  const free = plan === 'free';
  const grading: Stage2GradingAndAffectOutput = free
    ? { ...gradingOutput, plan: 'free', affectState: null, scaffoldingMode: null }
    : { ...gradingOutput, plan: 'pro' };
  return (
    <View
      name={demoPersonas.student.name}
      own
      sample
      grading={grading}
      worksheet={free ? null : demoWorksheet}
      worksheetNote=""
      worksheetProOnly={free}
      usage={free ? DEMO_FREE_USAGE : DEMO_PRO_USAGE}
      quirkRows={countQuirks([grading])}
    />
  );
}

function View({
  name,
  own,
  sample = false,
  latest = true,
  grading,
  worksheet,
  worksheetNote,
  worksheetProOnly,
  onWorksheetMade,
  usage,
  quirkRows,
  newQuirks,
}: {
  name: string;
  own: boolean;
  grading: Stage2GradingAndAffectOutput;
  worksheet: WS_3STAGE_V1 | null;
  worksheetNote: string;
  worksheetProOnly: boolean;
  /** Set when the worksheet can be made now; called with the new worksheet. */
  onWorksheetMade?: (ws: WS_3STAGE_V1) => void;
  usage: ApiUsage | null;
  /** Sample data on the How it works page: no upload button. */
  sample?: boolean;
  /** False when an older upload from the history is open. */
  latest?: boolean;
  /** The quirk collection (every quirk with its count). */
  quirkRows?: QuirkCount[];
  /** Quirks this upload earned for the first time. */
  newQuirks?: Set<string>;
}) {
  const { openCapture } = useRole();
  const limitReached = usage !== null && usage.plan === 'free' && usage.remaining === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {!latest
              ? `Diagnostic from ${formatWhen(grading.gradedAt) || 'an earlier upload'}`
              : own
                ? `Hi ${name.split(' ')[0]}, here’s your latest diagnostic`
                : 'Latest diagnostic'}
          </h1>
        </div>
        {sample ? (
          <span className="aero-badge aero-badge--accent">Sample data</span>
        ) : limitReached ? (
          <Link
            href="/plans"
            className="btn btn-primary"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Upgrade for more uploads
          </Link>
        ) : (
          <button
            onClick={() => openCapture()}
            className="btn btn-primary"
          >
            <UploadCloud className="h-4 w-4" aria-hidden /> Upload new work
          </button>
        )}
      </header>

      {/* The practice worksheet, up top so nobody has to scroll past the diagnostic to find it. */}
      {!sample && (worksheet || onWorksheetMade) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Layers className="h-4 w-4 text-indigo-600" aria-hidden />
            {worksheet ? 'Your practice worksheet for this upload is ready.' : 'Practice what went wrong on this upload.'}
          </p>
          {worksheet ? (
            <a href="#practice-worksheet" className="btn btn-sm btn-primary">
              Open practice worksheet
            </a>
          ) : (
            <MakeWorksheetButton gradingId={grading.gradingId} onMade={onWorksheetMade!} className="" />
          )}
        </div>
      )}

      {usage && <UploadsLeftMeter usage={usage} compact />}

      <QuirksEarned
        quirks={grading.quirks}
        heading={own ? 'Quirks you earned on this upload' : 'Quirks earned on this upload'}
        newIds={newQuirks}
      />
      <AffectCard grading={grading} />
      <PillarCards pillars={grading.pillarBreakdowns} />
      <StepDiagnostics grading={grading} />
      {quirkRows && <QuirkCollection rows={quirkRows} own={own} />}

      <div id="practice-worksheet" className="scroll-mt-24" />
      {worksheet ? (
        <WorksheetViewer worksheet={worksheet} steps={grading.stepDiagnostics} />
      ) : worksheetProOnly || grading.plan === 'free' ? (
        <LockedProCard
          title="3-stage practice worksheet"
          description="Pro builds a custom practice worksheet whenever your work has a mistake to practise."
          features={[
            'Stage A · Diagnostic Mirror: your line side-by-side with the corrected step.',
            'Stage B · Faded Scaffolding: guided practice with fill-in-the-blank checkpoints.',
            'Stage C · Independent Transfer: a fresh problem with a self-check list.',
          ]}
        />
      ) : (
        <section className="card flex items-start gap-3 p-6">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
          <div>
            <h2 className="font-semibold text-slate-900">Practice worksheet</h2>
            <p className="mt-1 text-sm text-slate-600">{worksheetNote}</p>
          </div>
        </section>
      )}
    </div>
  );
}
