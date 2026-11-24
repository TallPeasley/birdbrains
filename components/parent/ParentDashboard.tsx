'use client';

import { useEffect, useState } from 'react';
import EqaoForecast from '@/components/parent/EqaoForecast';
import FrictionAlerts from '@/components/parent/FrictionAlerts';
import MasteryChart from '@/components/parent/MasteryChart';
import PillarErrorChart from '@/components/parent/PillarErrorChart';
import { LoadError, Loading, NoWorkNotice, useDashboardGate } from '@/components/DashboardStates';
import {
  DEMO_FREE_USAGE,
  DEMO_PRO_USAGE,
  LockedProCard,
  UploadsLeftMeter,
} from '@/components/PlanUsageBanner';
import { api, ApiError } from '@/lib/api';
import { parentSummary as demoSummary } from '@/lib/mockData';
import { useSession } from '@/lib/session';
import type { ApiUsage, ParentProjectionSummary, PlanTier } from '@/types/birdBrains';
import { MathText } from '@/components/MathText';
import StudentProgressPanel from '@/components/StudentProgressPanel';
import UploadHistory from '@/components/account/UploadHistory';
import { LinkChildForm } from '@/components/DashboardStates';
import type { ProgressReport } from '@/types/birdBrains';

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; usage: ApiUsage | null }
  | { kind: 'error'; message: string }
  | { kind: 'data'; summary: ParentProjectionSummary; usage: ApiUsage | null; progress: ProgressReport | null };

export default function ParentDashboard() {
  const { live, profile, activeStudentId, setActiveStudentId, getToken, dataVersion } = useSession();
  const gate = useDashboardGate('parent');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!live || !activeStudentId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const token = await getToken();
      const usagePromise = api.usage(token, activeStudentId).catch(() => null);
      const progressPromise = api.progress(token, activeStudentId).catch(() => null);
      try {
        const [summary, usage, progress] = await Promise.all([
          api.parentSummary(token, activeStudentId),
          usagePromise,
          progressPromise,
        ]);
        if (!cancelled) setState({ kind: 'data', summary, usage, progress });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          const usage = await usagePromise;
          if (!cancelled) setState({ kind: 'empty', usage });
        } else {
          setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

  if (!live) return <View s={demoSummary} usage={DEMO_PRO_USAGE} />;
  if (gate) return gate;
  if (state.kind === 'loading') return <Loading variant="parent" />;
  const linked = profile?.children?.length
    ? profile.children
    : (profile?.childStudentIds ?? []).map((id, i) => ({ studentId: id, name: `Child ${i + 1}` }));
  const picker = <ChildPicker linked={linked} active={activeStudentId} onPick={setActiveStudentId} />;

  if (state.kind === 'empty') {
    return (
      <div className="space-y-6">
        {picker}
        {state.usage && <UploadsLeftMeter usage={state.usage} />}
        <NoWorkNotice variant="parent" />
      </div>
    );
  }
  if (state.kind === 'error') {
    return <LoadError title="We couldn’t load the dashboard" message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  return (
    <div className="space-y-6">
      {picker}
      <View s={state.summary} usage={state.usage} />
      {state.progress && <StudentProgressPanel report={state.progress} />}
      <UploadHistory />
    </div>
  );
}

/** Which child the dashboard shows, by name, plus linking another child. */
function ChildPicker({
  linked,
  active,
  onPick,
}: {
  linked: { studentId: string; name: string }[];
  active: string | null;
  onPick: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      {linked.length > 1 ? (
        <label className="flex items-center gap-2">
          Showing
          <select
            value={active ?? ''}
            onChange={(e) => onPick(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {linked.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-sm btn-link">
        {adding ? 'Close' : 'Link another child'}
      </button>
      {adding && (
        <div className="w-full">
          <LinkChildForm />
        </div>
      )}
    </div>
  );
}

/** The sample parent (Jordan) on the How it works page: pure mock data, no session or API calls. */
export function ParentDemo({ plan }: { plan: PlanTier }) {
  return <View s={demoSummary} usage={plan === 'free' ? DEMO_FREE_USAGE : DEMO_PRO_USAGE} sample />;
}

function View({ s, usage, sample = false }: { s: ParentProjectionSummary; usage: ApiUsage | null; sample?: boolean }) {
  const isFree = usage?.plan === 'free';
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Parent dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            How {s.studentName.split(' ')[0]} is doing in <MathText text={s.course} />
          </h1>
        </div>
        {sample && <span className="aero-badge aero-badge--accent">Sample data</span>}
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {s.studentName} · <MathText text={s.course === 'MPM2D' ? 'Grade 10' : 'Grade 9'} />
        </span>
      </header>

      {usage && <UploadsLeftMeter usage={usage} compact />}

      {isFree ? (
        <LockedProCard
          title="Frustration & anxiety signals"
          description="Pro detects moments where the work got frustrating or rushed and suggests concrete ways to help at home."
        />
      ) : (
        <FrictionAlerts alerts={s.cognitiveFrictionAlerts} />
      )}
      <MasteryChart strands={s.strandMasteries} />
      <div className="grid gap-6 lg:grid-cols-2">
        <EqaoForecast summary={s} />
        <PillarErrorChart data={s.pillarErrorDistribution} />
      </div>
    </div>
  );
}
