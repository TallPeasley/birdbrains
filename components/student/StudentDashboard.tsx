'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import AffectCard from '@/components/student/AffectCard';
import PillarCards from '@/components/student/PillarCards';
import StepDiagnostics from '@/components/student/StepDiagnostics';
import WorksheetViewer from '@/components/student/WorksheetViewer';
import { LoadError, Loading, NoWorkNotice, useDashboardGate } from '@/components/DashboardStates';
import { api, ApiError } from '@/lib/api';
import { demoPersonas, gradingOutput, worksheet as demoWorksheet } from '@/lib/mockData';
import { useSession } from '@/lib/session';
import type { Stage2GradingAndAffectOutput, WS_3STAGE_V1 } from '@/types/birdBrains';

const WORKSHEET_NOTES: Record<string, string> = {
  WORKSHEET_QUEUED: 'Your practice worksheet is built overnight. Check back tomorrow morning.',
  WORKSHEET_PENDING: 'Your practice worksheet is being built right now. Check back in the morning.',
  WORKSHEET_NOT_NEEDED: 'No mistakes to practise from this one. No worksheet needed!',
  WORKSHEET_FAILED: 'We could not build a worksheet for this one. Upload your next piece of work to get a new one.',
};

type State =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'data'; grading: Stage2GradingAndAffectOutput; worksheet: WS_3STAGE_V1 | null; worksheetNote: string };

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
      const grading = await api.latestGrading(token, activeStudentId);
      let worksheet: WS_3STAGE_V1 | null = null;
      let worksheetNote = '';
      try {
        worksheet = await api.worksheet(token, grading.gradingId);
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        worksheetNote = WORKSHEET_NOTES[err.detail] ?? WORKSHEET_NOTES.WORKSHEET_QUEUED;
      }
      if (!cancelled) setState({ kind: 'data', grading, worksheet, worksheetNote });
    })().catch((err) => {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 404) setState({ kind: 'empty' });
      else setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

  if (!live) {
    return (
      <View name={demoPersonas.student.name} own grading={gradingOutput} worksheet={demoWorksheet} worksheetNote="" />
    );
  }
  if (gate) return gate;
  if (state.kind === 'loading') return <Loading variant="student" />;
  if (state.kind === 'empty') return <NoWorkNotice />;
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
}: {
  name: string;
  own: boolean;
  grading: Stage2GradingAndAffectOutput;
  worksheet: WS_3STAGE_V1 | null;
  worksheetNote: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Student dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {own ? `Hi ${name.split(' ')[0]}, here’s your latest diagnostic` : 'Latest diagnostic'}
        </h1>
      </header>
      <AffectCard grading={grading} />
      <PillarCards pillars={grading.pillarBreakdowns} />
      <StepDiagnostics grading={grading} />
      {worksheet ? (
        <WorksheetViewer worksheet={worksheet} />
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
