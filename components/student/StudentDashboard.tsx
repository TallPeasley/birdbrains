'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Camera,
  ChevronRight,
  History,
  Layers,
  Presentation,
  RefreshCw,
  Smartphone,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import PhoneQrPanel from '@/components/PhoneQrPanel';
import { useRole } from '@/lib/roleContext';
import AffectCard from '@/components/student/AffectCard';
import PillarCards from '@/components/student/PillarCards';
import StepDiagnostics from '@/components/student/StepDiagnostics';
import WorksheetViewer from '@/components/student/WorksheetViewer';
import { PillarQuirks, QuirkTracker } from '@/components/student/Quirks';
import { firstTimeQuirks, tallyFromGradings } from '@/lib/quirks';
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
import { UPLOAD_MODE_ORDER, UPLOAD_MODES, type UploadMode } from '@/lib/uploadModes';
import type { ApiUsage, PlanTier, PillarCategory, PillarTally, Stage2GradingAndAffectOutput, WS_3STAGE_V1 } from '@/types/birdBrains';

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

/** The portal opens on the hub; the worksheet and the upload history are one tap away. */
type Panel = 'hub' | 'worksheet' | 'history';

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
  const [quirkRows, setQuirkRows] = useState<PillarTally[] | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<Panel>('hub');

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
      setQuirkRows(quirks ?? tallyFromGradings(history));
      if (history.length === 0) {
        setState({ kind: 'empty', usage });
        return;
      }
      setState({ kind: 'data', history, usage });
      // A new upload opens by itself; otherwise keep the one being looked at.
      const fresh = known.current.size > 0 && !known.current.has(history[0].gradingId);
      known.current = new Set(history.map((g) => g.gradingId));
      setSelectedId((id) => (!fresh && id && known.current.has(id) ? id : history[0].gradingId));
      // A just-finished upload opens its result in the history view.
      if (fresh) setPanel('history');
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
    if (panel === 'worksheet') {
      return (
        <PanelFrame title="Today’s worksheet" onBack={() => setPanel('hub')}>
          <WorksheetViewer worksheet={demoWorksheet} steps={gradingOutput.stepDiagnostics} />
        </PanelFrame>
      );
    }
    if (panel === 'history') {
      return (
        <PanelFrame title="Upload history" onBack={() => setPanel('hub')}>
          <View
            name={demoPersonas.student.name}
            own
            grading={gradingOutput}
            worksheet={demoWorksheet}
            worksheetNote=""
            worksheetProOnly={false}
            usage={DEMO_PRO_USAGE}
            quirkRows={tallyFromGradings([gradingOutput])}
          />
        </PanelFrame>
      );
    }
    return (
      <PortalHub
        name={demoPersonas.student.name}
        usage={DEMO_PRO_USAGE}
        live={false}
        worksheet={{ state: 'ready', line: demoWorksheet.title }}
        historyCount={1}
        lastUpload={gradingOutput.topic}
        onWorksheet={() => setPanel('worksheet')}
        onHistory={() => setPanel('history')}
      />
    );
  }
  if (gate) return gate;
  if (state.kind === 'loading') return <Loading variant="student" />;
  if (state.kind === 'empty') {
    return (
      <PortalHub
        name={profile?.name ?? ''}
        usage={state.usage}
        live
        worksheet={{ state: 'none', line: 'Your first practice worksheet is made from your first graded upload.' }}
        historyCount={0}
        onWorksheet={() => undefined}
        onHistory={() => undefined}
        empty={<NoWorkNotice />}
      />
    );
  }
  if (state.kind === 'error') {
    return <LoadError title="We couldn’t load your results" message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const latestGrading = state.history[0];
  const grading = state.history.find((g) => g.gradingId === selectedId) ?? latestGrading;
  const sheet = ws && ws.gradingId === grading.gradingId ? ws : null;
  const backToHub = () => {
    setSelectedId(latestGrading.gradingId);
    setPanel('hub');
  };

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

  if (panel === 'hub') {
    // The hub always describes the newest upload's worksheet.
    const latestSheet = ws && ws.gradingId === latestGrading.gradingId ? ws : null;
    const worksheetSummary: HubWorksheet = !latestSheet
      ? { state: 'loading', line: 'Loading your latest practice worksheet…' }
      : latestSheet.worksheet
        ? { state: 'ready', line: latestSheet.worksheet.title }
        : latestSheet.proOnly || latestGrading.plan === 'free'
          ? { state: 'locked', line: 'Pro makes a practice worksheet from every upload with a mistake to practise.' }
          : { state: latestSheet.canMake ? 'makeable' : 'waiting', line: latestSheet.note };
    return (
      <PortalHub
        name={profile!.name}
        usage={state.usage}
        live
        worksheet={worksheetSummary}
        historyCount={state.history.length}
        lastUpload={latestGrading.topic}
        onWorksheet={() => {
          setSelectedId(latestGrading.gradingId);
          setPanel('worksheet');
        }}
        onHistory={() => setPanel('history')}
      />
    );
  }

  if (panel === 'worksheet') {
    return (
      <PanelFrame title="Today’s worksheet" subtitle={latestGrading.topic || undefined} onBack={backToHub}>
        {!sheet ? (
          <Loading variant="student" />
        ) : sheet.worksheet ? (
          <WorksheetViewer worksheet={sheet.worksheet} steps={grading.stepDiagnostics} />
        ) : sheet.proOnly || grading.plan === 'free' ? (
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
          <section className="card flex flex-wrap items-start gap-3 p-6">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900">Practice worksheet</h2>
              <p className="mt-1 text-sm text-slate-600">{sheet.note}</p>
            </div>
            {sheet.canMake && (
              <MakeWorksheetButton
                gradingId={grading.gradingId}
                onMade={(made) => setWs({ gradingId: sheet.gradingId, worksheet: made, note: '', proOnly: false })}
                className=""
              />
            )}
          </section>
        )}
      </PanelFrame>
    );
  }

  return (
    <PanelFrame title="Upload history" subtitle={`${state.history.length} graded`} onBack={backToHub}>
      <UploadHistory history={state.history} selectedId={grading.gradingId} onSelect={setSelectedId} always />
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
        quirkRows={quirkRows ?? tallyFromGradings(state.history)}
        newQuirks={firstTimeQuirks(state.history, grading.gradingId)}
      />
    </PanelFrame>
  );
}

interface HubWorksheet {
  state: 'ready' | 'makeable' | 'waiting' | 'locked' | 'loading' | 'none';
  line: string;
}

const MODE_ICONS: Record<UploadMode, typeof Camera> = {
  WORKSHEET_PHOTO: Camera,
  SLIDES_DECK: Presentation,
  TEXTBOOK_ASSIST: BookOpen,
};

/**
 * The student portal's home: today's worksheet, the upload history, and the three ways
 * to send work (photo, slides, textbook). Results open from here instead of filling the
 * page by default.
 */
function PortalHub({
  name,
  usage,
  live,
  worksheet,
  historyCount,
  lastUpload,
  onWorksheet,
  onHistory,
  empty,
}: {
  name: string;
  usage: ApiUsage | null;
  live: boolean;
  worksheet: HubWorksheet;
  historyCount: number;
  lastUpload?: string;
  onWorksheet: () => void;
  onHistory: () => void;
  /** Shown under the hub when there is nothing graded yet. */
  empty?: React.ReactNode;
}) {
  const { openCaptureMode } = useRole();
  const limitReached = usage !== null && usage.plan === 'free' && usage.remaining === 0;
  const first = name.split(' ')[0];
  const noWorksheet = worksheet.state === 'none';
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Student portal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {first ? `Hi ${first}, what are we working on?` : 'What are we working on?'}
          </h1>
        </div>
        {limitReached && (
          <Link href="/plans" className="btn btn-primary">
            <Sparkles className="h-4 w-4" aria-hidden /> Upgrade for more uploads
          </Link>
        )}
      </header>

      {usage && <UploadsLeftMeter usage={usage} compact />}

      {/* Row 1: today's worksheet and online practice */}
      <button
        type="button"
        onClick={onWorksheet}
        disabled={noWorksheet}
        className="group flex w-full items-center gap-4 rounded-2xl bg-indigo-600 px-5 py-5 text-left text-white shadow-[0_10px_30px_-12px_rgba(79,70,229,0.7)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none sm:px-6 sm:py-6"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
          <Layers className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold leading-snug sm:text-xl">
            View Today’s Worksheet / Online Practice Portal
          </span>
          <span className="mt-1 block text-sm text-indigo-100">{worksheet.line}</span>
        </span>
        {!noWorksheet && <ChevronRight className="h-6 w-6 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />}
      </button>

      {/* Row 2: upload history */}
      <button
        type="button"
        onClick={onHistory}
        disabled={historyCount === 0}
        className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
          <History className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">Upload History</span>
          <span className="block truncate text-sm text-slate-500">
            {historyCount === 0
              ? 'Nothing graded yet.'
              : `${historyCount} graded upload${historyCount === 1 ? '' : 's'}${lastUpload ? ` · latest: ${lastUpload}` : ''}`}
          </span>
        </span>
        {historyCount > 0 && <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />}
      </button>

      {/* Row 3: the three ways to send work */}
      <div className="grid gap-3 sm:grid-cols-3">
        {UPLOAD_MODE_ORDER.map((m) => {
          const cfg = UPLOAD_MODES[m];
          const Icon = MODE_ICONS[m];
          const soon = live && !cfg.liveReady;
          return (
            <button
              key={m}
              type="button"
              onClick={() => openCaptureMode(m)}
              className="card flex h-full flex-col items-start gap-3 p-5 text-left transition hover:border-indigo-300 hover:shadow-md"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {soon && <span className="aero-badge">Coming soon</span>}
              </span>
              <span className="font-display font-bold tracking-display text-slate-900">{cfg.title}</span>
              <span className="text-sm text-slate-600">{cfg.blurb}</span>
            </button>
          );
        })}
      </div>

      {empty}
    </div>
  );
}

/** A portal page (worksheet or history) with a way back to the hub. */
function PanelFrame({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="btn btn-sm btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Student portal
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Every graded upload, newest first. Picking one shows its results below. */
function UploadHistory({
  history,
  selectedId,
  onSelect,
  always = false,
}: {
  history: Stage2GradingAndAffectOutput[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Show the list even with one upload (the history page). */
  always?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (history.length < (always ? 1 : 2)) return null;
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
      quirkRows={tallyFromGradings([grading])}
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
  /** Quirks and antiquirks per pillar over every upload. */
  quirkRows?: PillarTally[];
  /** Pillars whose quirk this upload earned for the first time. */
  newQuirks?: Set<PillarCategory>;
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

      <PillarQuirks
        pillars={grading.pillarQuirks}
        heading={own ? 'Your quirks and antiquirks on this upload' : 'Quirks and antiquirks on this upload'}
        newPillars={newQuirks}
        own={own}
      />
      <AffectCard grading={grading} />
      <PillarCards pillars={grading.pillarBreakdowns} />
      <StepDiagnostics grading={grading} />
      {quirkRows && <QuirkTracker rows={quirkRows} own={own} />}

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
