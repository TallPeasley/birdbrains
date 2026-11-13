'use client';

import { useEffect, useState } from 'react';
import EqaoForecast from '@/components/parent/EqaoForecast';
import FrictionAlerts from '@/components/parent/FrictionAlerts';
import MasteryChart from '@/components/parent/MasteryChart';
import PillarErrorChart from '@/components/parent/PillarErrorChart';
import { LoadError, Loading, NoWorkNotice, useDashboardGate } from '@/components/DashboardStates';
import { api, ApiError } from '@/lib/api';
import { parentSummary as demoSummary } from '@/lib/mockData';
import { useSession } from '@/lib/session';
import type { ParentProjectionSummary } from '@/types/birdBrains';

type State =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'data'; summary: ParentProjectionSummary };

export default function ParentDashboard() {
  const { live, profile, activeStudentId, setActiveStudentId, getToken, dataVersion } = useSession();
  const gate = useDashboardGate('parent');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!live || !activeStudentId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getToken()
      .then((token) => api.parentSummary(token, activeStudentId))
      .then((summary) => !cancelled && setState({ kind: 'data', summary }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setState({ kind: 'empty' });
        else setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
      });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

  if (!live) return <View s={demoSummary} />;
  if (gate) return gate;
  if (state.kind === 'loading') return <Loading variant="parent" />;
  if (state.kind === 'empty') return <NoWorkNotice />;
  if (state.kind === 'error') {
    return <LoadError title="We couldn’t load the dashboard" message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const children = profile?.role === 'parent' ? profile.childStudentIds : [];
  return (
    <>
      {children.length > 1 && (
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          Showing
          <select
            value={activeStudentId ?? ''}
            onChange={(e) => setActiveStudentId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {children.map((id, i) => (
              <option key={id} value={id}>
                Child {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      <View s={state.summary} />
    </>
  );
}

function View({ s }: { s: ParentProjectionSummary }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Parent dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            How {s.studentName.split(' ')[0]} is doing in {s.course}
          </h1>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {s.studentName} · {s.course === 'MPM2D' ? 'Grade 10' : 'Grade 9'}
        </span>
      </header>

      <FrictionAlerts alerts={s.cognitiveFrictionAlerts} />
      <MasteryChart strands={s.strandMasteries} />
      <div className="grid gap-6 lg:grid-cols-2">
        <EqaoForecast summary={s} />
        <PillarErrorChart data={s.pillarErrorDistribution} />
      </div>
    </div>
  );
}
