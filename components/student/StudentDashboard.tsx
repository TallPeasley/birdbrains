'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Sparkles, UploadCloud } from 'lucide-react';
import { useRole } from '@/lib/roleContext';
import AffectCard from '@/components/student/AffectCard';
import PillarCards from '@/components/student/PillarCards';
import StepDiagnostics from '@/components/student/StepDiagnostics';
import WorksheetViewer from '@/components/student/WorksheetViewer';
import { LoadError, Loading, NoWorkNotice, useDashboardGate } from '@/components/DashboardStates';
import {
  DEMO_PRO_USAGE,
  LockedProCard,
  UploadsLeftMeter,
} from '@/components/PlanUsageBanner';
import { api, ApiError } from '@/lib/api';
import { demoPersonas, gradingOutput, worksheet as demoWorksheet } from '@/lib/mockData';
import { useSession } from '@/lib/session';
import type { ApiUsage, Stage2GradingAndAffectOutput, WS_3STAGE_V1 } from '@/types/birdBrains';

const WORKSHEET_NOTES: Record<string, string> = {
  WORKSHEET_QUEUED: 'Your practice worksheet is built overnight. Check back tomorrow morning.',
  WORKSHEET_PENDING: 'Your practice worksheet is being built right now. Check back in the morning.',
  WORKSHEET_NOT_NEEDED: 'No mistakes to practise from this one. No worksheet needed!',
  WORKSHEET_FAILED: 'We could not build a worksheet for this one. Upload your next piece of work to get a new one.',
};

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; usage: ApiUsage | null }
  | { kind: 'error'; message: string }
  | {
      kind: 'data';
      grading: Stage2GradingAndAffectOutput;
      worksheet: WS_3STAGE_V1 | null;
      worksheetNote: string;
      worksheetProOnly: boolean;
      usage: ApiUsage | null;
    };

export default function StudentDashboard() {
  const { live, profile, activeStudentId, getToken, dataVersion } = useSession();
  const gate = useDashboardGate('student');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!live || !activeStudentId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const token = await getToken();
      const usagePromise = api.usage(token, activeStudentId).catch(() => null);
      let grading: Stage2GradingAndAffectOutput;
      try {
        grading = await api.latestGrading(token, activeStudentId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          const usage = await usagePromise;
          if (!cancelled) setState({ kind: 'empty', usage });
          return;
        }
        throw err;
      }
      let worksheet: WS_3STAGE_V1 | null = null;
      let worksheetNote = '';
      let worksheetProOnly = false;
      try {
        worksheet = await api.worksheet(token, grading.gradingId);
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        if (err.detail === 'WORKSHEET_PRO_ONLY') {
          worksheetProOnly = true;
        } else {
          worksheetNote = WORKSHEET_NOTES[err.detail] ?? WORKSHEET_NOTES.WORKSHEET_QUEUED;
        }
      }
      const usage = await usagePromise;
      if (!cancelled) {
        setState({ kind: 'data', grading, worksheet, worksheetNote, worksheetProOnly, usage });
      }
    })().catch((err) => {
      if (cancelled) return;
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

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
  return <View name={profile!.name} own={profile!.role === 'student'} {...state} />;
}

function View({
  name,
  own,
  grading,
  worksheet,
  worksheetNote,
  worksheetProOnly,
  usage,
}: {
  name: string;
  own: boolean;
  grading: Stage2GradingAndAffectOutput;
  worksheet: WS_3STAGE_V1 | null;
  worksheetNote: string;
  worksheetProOnly: boolean;
  usage: ApiUsage | null;
}) {
  const { openCapture } = useRole();
  const limitReached = usage !== null && usage.plan === 'free' && usage.remaining === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {own ? `Hi ${name.split(' ')[0]}, here’s your latest diagnostic` : 'Latest diagnostic'}
          </h1>
        </div>
        {limitReached ? (
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-md bg-brand-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Upgrade for more uploads
          </Link>
        ) : (
          <button
            onClick={openCapture}
            className="inline-flex items-center gap-2 rounded-md bg-brand-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            <UploadCloud className="h-4 w-4" aria-hidden /> Upload new work
          </button>
        )}
      </header>

      {usage && <UploadsLeftMeter usage={usage} compact />}

      <AffectCard grading={grading} />
      <PillarCards pillars={grading.pillarBreakdowns} />
      <StepDiagnostics grading={grading} />

      {worksheet ? (
        <WorksheetViewer worksheet={worksheet} />
      ) : worksheetProOnly || grading.plan === 'free' ? (
        <LockedProCard
          title="Nightly 3-stage practice worksheet"
          description="Pro builds a custom practice worksheet overnight whenever your work has a mistake to practise."
          features={[
            'Stage A · Diagnostic Mirror: your line side-by-side with the corrected step.',
            'Stage B · Faded Scaffolding: guided practice with fill-in-the-blank checkpoints.',
            'Stage C · Independent Transfer: a fresh problem with a self-check list.',
          ]}
        />
      ) : (
        <section className="card flex items-start gap-3 p-6">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-3" aria-hidden />
          <div>
            <h2 className="font-semibold text-slate-900">Practice worksheet</h2>
            <p className="mt-1 text-sm text-slate-600">{worksheetNote}</p>
          </div>
        </section>
      )}
    </div>
  );
}
