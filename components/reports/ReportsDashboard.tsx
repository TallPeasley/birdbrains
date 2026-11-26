'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Crown,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useRole } from '@/lib/roleContext';
import { Loading, SignInNotice } from '@/components/DashboardStates';
import { PILLARS } from '@/lib/pillars';
import { mistakeName } from '@/lib/errorCodes';
import type { CohortReport, PlanTier, ProgressReport } from '@/types/birdBrains';

const DEMO_PROGRESS: ProgressReport = {
  studentId: 'stu_zvd02PynvXEK',
  studentName: 'Alex Mercer',
  course: 'MPM2D',
  plan: 'pro',
  uploads: 5,
  firstUploadAt: '2026-10-18T14:20:00Z',
  lastUploadAt: '2026-11-14T19:05:00Z',
  averageMastery: 0.78,
  masteryByStrand: [
    { strandName: 'Quadratic Relations', mastery: 0.82 },
    { strandName: 'Analytic Geometry', mastery: 0.76 },
    { strandName: 'Trigonometry', mastery: 0.71 },
  ],
  timeline: [
    { date: 'Oct 18', strand: 'Analytic Geometry', scoreFraction: 0.65, masteryAfter: 0.65, rootErrors: 2, valence: -0.2 },
    { date: 'Oct 25', strand: 'Quadratic Relations', scoreFraction: 0.72, masteryAfter: 0.71, rootErrors: 2, valence: 0.1 },
    { date: 'Nov 02', strand: 'Quadratic Relations', scoreFraction: 0.8, masteryAfter: 0.76, rootErrors: 1, valence: 0.35 },
    { date: 'Nov 09', strand: 'Trigonometry', scoreFraction: 0.75, masteryAfter: 0.75, rootErrors: 1, valence: 0.2 },
    { date: 'Nov 14', strand: 'Quadratic Relations', scoreFraction: 0.88, masteryAfter: 0.82, rootErrors: 1, valence: 0.6 },
  ],
  errorCodes: [
    { code: 'PRC_SIGN_OR_FACTOR_DROPPED', name: 'Outer coefficient missed on bracket exit', pillar: 'PRC', count: 3, students: 1, lastSeen: '2026-11-14' },
    { code: 'FAC_ARITHMETIC_SLIP', name: 'Signed arithmetic slip', pillar: 'FAC', count: 2, students: 1, lastSeen: '2026-11-02' },
    { code: 'COM_MISSING_UNITS', name: 'Missing final coordinate / unit statement', pillar: 'COM', count: 1, students: 1, lastSeen: '2026-11-09' },
  ],
  recurringCodes: ['PRC_SIGN_OR_FACTOR_DROPPED', 'FAC_ARITHMETIC_SLIP'],
  pillarErrorDistribution: [
    { pillar: 'PRC', percentageOfTotalErrors: 50 },
    { pillar: 'FAC', percentageOfTotalErrors: 33 },
    { pillar: 'COM', percentageOfTotalErrors: 17 },
  ],
};

const DEMO_COHORT: CohortReport = {
  googleCourseId: 'gc_mpm2d_p2',
  uploads: 18,
  students: [
    {
      studentId: 'stu_demo_004',
      studentName: 'Jordan Lee',
      uploads: 4,
      lastUploadAt: '2026-11-14T16:10:00Z',
      averageMastery: 0.44,
      topCode: 'CON_SIGN_DIRECTION_MEANING',
      recurringCodes: ['CON_SIGN_DIRECTION_MEANING', 'PRC_SIGN_OR_FACTOR_DROPPED'],
      needsAttention: true,
    },
    {
      studentId: 'stu_zvd02PynvXEK',
      studentName: 'Alex Mercer',
      uploads: 5,
      lastUploadAt: '2026-11-14T19:05:00Z',
      averageMastery: 0.78,
      topCode: 'PRC_SIGN_OR_FACTOR_DROPPED',
      recurringCodes: ['PRC_SIGN_OR_FACTOR_DROPPED'],
      needsAttention: true,
    },
    {
      studentId: 'stu_demo_002',
      studentName: 'Priya Patel',
      uploads: 6,
      lastUploadAt: '2026-11-15T11:30:00Z',
      averageMastery: 0.89,
      topCode: null,
      recurringCodes: [],
      needsAttention: false,
    },
  ],
  masteryByStrand: [
    { strandName: 'Quadratic Relations', mastery: 0.74 },
    { strandName: 'Analytic Geometry', mastery: 0.69 },
    { strandName: 'Trigonometry', mastery: 0.65 },
  ],
  errorCodes: [
    { code: 'PRC_SIGN_OR_FACTOR_DROPPED', name: 'Outer coefficient missed on bracket exit', pillar: 'PRC', count: 7, students: 4, lastSeen: '2026-11-14' },
    { code: 'CON_SIGN_DIRECTION_MEANING', name: 'Vertex sign inversion', pillar: 'CON', count: 5, students: 3, lastSeen: '2026-11-14' },
    { code: 'FAC_ARITHMETIC_SLIP', name: 'Signed arithmetic slip', pillar: 'FAC', count: 4, students: 3, lastSeen: '2026-11-12' },
  ],
  pillarErrorDistribution: [
    { pillar: 'PRC', percentageOfTotalErrors: 44 },
    { pillar: 'CON', percentageOfTotalErrors: 31 },
    { pillar: 'FAC', percentageOfTotalErrors: 25 },
  ],
};

export default function ReportsDashboard() {
  const { role } = useRole();
  const { live, demo, ready, signedIn, profile, activeStudentId, getToken } = useSession();

  const isTeacher = profile?.role === 'teacher';
  const [tab, setTab] = useState<'progress' | 'class'>('progress');
  const [demoPlan, setDemoPlan] = useState<PlanTier>('pro');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [cohort, setCohort] = useState<CohortReport | null>(null);
  const [cohortProOnly, setCohortProOnly] = useState(false);

  useEffect(() => {
    if (isTeacher) setTab('class');
  }, [isTeacher]);

  useEffect(() => {
    if (!ready) return;
    if (!live) {
      setProgress(
        demoPlan === 'free'
          ? {
              ...DEMO_PROGRESS,
              plan: 'free',
              timeline: DEMO_PROGRESS.timeline.map((pt) => ({ ...pt, valence: null })),
            }
          : DEMO_PROGRESS,
      );
      setCohort(demoPlan === 'pro' ? DEMO_COHORT : null);
      setCohortProOnly(demoPlan === 'free');
      setLoading(false);
      return;
    }

    if (!signedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const token = await getToken();
        if (tab === 'progress' && activeStudentId) {
          const rep = await api.progress(token, activeStudentId);
          if (!cancelled) setProgress(rep);
        } else if (tab === 'class') {
          try {
            const rep = await api.teacherReport(token);
            if (!cancelled) {
              setCohort(rep);
              setCohortProOnly(false);
            }
          } catch (err) {
            if (err instanceof ApiError && err.status === 402) {
              if (!cancelled) setCohortProOnly(true);
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, live, signedIn, tab, activeStudentId, getToken, demoPlan]);

  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Loading variant="parent" />
      </div>
    );
  }

  if (live && !signedIn && !demo) {
    return <SignInNotice />;
  }

  const showClassTab = !live || isTeacher;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Longitudinal analytics</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Progress &amp; Class Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track mastery growth, recurring error codes, and students who need extra support.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!live && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs">
              {(['pro', 'free'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDemoPlan(tier)}
                  className={`rounded-lg px-2.5 py-1 font-semibold capitalize ${
                    demoPlan === tier ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          )}
          <Link
            href={`/${role}`}
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </div>
      </header>

      {showClassTab && (
        <div role="tablist" aria-label="Report views" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'progress'}
            onClick={() => setTab('progress')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === 'progress' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" aria-hidden /> Student Progress
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'class'}
            onClick={() => setTab('class')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === 'class' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden /> Class Overview
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {tab === 'progress' && progress && (
        progress.uploads === 0 ? (
          <div className="card p-8 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No graded uploads yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a math page to start building {progress.studentName}&apos;s longitudinal mastery report.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5">
                <p className="eyebrow">Student</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{progress.studentName}</p>
                <p className="text-xs text-slate-500">{progress.course} · {progress.plan.toUpperCase()} plan</p>
              </div>
              <div className="card p-5">
                <p className="eyebrow">Average Mastery</p>
                <p className="mt-1 text-2xl font-bold text-indigo-700">
                  {progress.averageMastery !== null ? `${Math.round(progress.averageMastery * 100)}%` : '—'}
                </p>
                <p className="text-xs text-slate-500">{progress.uploads} graded uploads</p>
              </div>
              <div className="card p-5">
                <p className="eyebrow">Mistakes that keep coming back</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {progress.recurringCodes.length === 0 ? (
                    <span className="text-xs text-slate-500">None yet</span>
                  ) : (
                    progress.recurringCodes.map((code) => (
                      <span key={code} className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
                        {mistakeName(code)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Mastery over time chart */}
            <section className="card p-5 sm:p-6">
              <h2 className="text-base font-bold text-slate-900">Mastery Over Time</h2>
              <p className="text-xs text-slate-500">EWMA mastery progression across graded submissions</p>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progress.timeline.map((p) => ({ ...p, masteryPct: Math.round(p.masteryAfter * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="masteryPct" name="Mastery %" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Mood trend (Pro) or Locked card (Free) */}
            {progress.plan === 'free' ? (
              <section className="card border-amber-200 bg-amber-50/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Mood &amp; Valence Trend (Pro)</h3>
                      <p className="text-xs text-slate-600">
                        Track confidence and frustration trends across assignments with Quark Pro.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/plans"
                    className="btn btn-sm btn-primary"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> Upgrade to Pro
                  </Link>
                </div>
              </section>
            ) : (
              <section className="card p-5 sm:p-6">
                <h2 className="text-base font-bold text-slate-900">Mood &amp; Confidence Trend</h2>
                <p className="text-xs text-slate-500">Estimated emotional valence (-1 frustrated to +1 confident)</p>
                <div className="mt-4 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progress.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="valence" name="Valence" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Strand mastery & error codes */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card p-5">
                <h2 className="text-base font-bold text-slate-900">Mastery by Strand</h2>
                <ul className="mt-4 space-y-3">
                  {progress.masteryByStrand.map((s) => (
                    <li key={s.strandName}>
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{s.strandName}</span>
                        <span>{Math.round(s.mastery * 100)}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.round(s.mastery * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card p-5">
                <h2 className="text-base font-bold text-slate-900">Mistakes by kind</h2>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {progress.errorCodes.map((ec) => (
                    <li key={ec.code} className="flex items-center justify-between py-2.5">
                      <div>
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full p-0 align-middle text-xs font-bold text-white"
                          style={{ backgroundColor: PILLARS[ec.pillar].color }}
                          aria-hidden
                        />
                        <span className="text-xs font-medium text-slate-700">{mistakeName(ec.code, ec.name)}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{ec.count}×</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )
      )}

      {tab === 'class' && (
        cohortProOnly ? (
          <section className="card border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  <Crown className="h-3.5 w-3.5" aria-hidden /> Pro Teacher Feature
                </span>
                <h2 className="text-xl font-bold text-slate-900">Upgrade to Pro for Class Reports</h2>
                <p className="max-w-xl text-sm text-slate-600">
                  See which students need attention, track class-wide strand mastery, and spot common misconceptions across your cohort.
                </p>
              </div>
              <Link
                href="/plans"
                className="shrink-0 btn btn-primary"
              >
                <Sparkles className="h-4 w-4" aria-hidden /> View Pro Plan
              </Link>
            </div>
          </section>
        ) : cohort && (
          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-base font-bold text-slate-900">Students Needing Attention &amp; Cohort Roster</h2>
                <p className="text-xs text-slate-500">
                  {cohort.uploads} total graded uploads across {cohort.students.length} students
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Uploads</th>
                      <th className="px-5 py-3">Mastery</th>
                      <th className="px-5 py-3">Top / Recurring</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cohort.students.map((st) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-semibold text-slate-900">{st.studentName}</td>
                        <td className="px-5 py-3 text-slate-600">{st.uploads}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {st.averageMastery !== null ? `${Math.round(st.averageMastery * 100)}%` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {st.recurringCodes.length > 0 ? (
                              st.recurringCodes.map((c) => (
                                <span key={c} className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
                                  {mistakeName(c)}
                                </span>
                              ))
                            ) : st.topCode ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {mistakeName(st.topCode)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {st.needsAttention ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                              <AlertTriangle className="h-3 w-3" aria-hidden /> Needs attention
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                              On track
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card p-5">
                <h2 className="text-base font-bold text-slate-900">Class Mastery by Strand</h2>
                <ul className="mt-4 space-y-3">
                  {cohort.masteryByStrand.map((s) => (
                    <li key={s.strandName}>
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{s.strandName}</span>
                        <span>{Math.round(s.mastery * 100)}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.round(s.mastery * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card p-5">
                <h2 className="text-base font-bold text-slate-900">Most Common Class Errors</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {cohort.errorCodes.map((ec) => (
                    <li key={ec.code} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full p-0 align-middle font-bold text-white"
                          style={{ backgroundColor: PILLARS[ec.pillar].color }}
                          aria-hidden
                        />
                        <span className="font-medium text-slate-700">{mistakeName(ec.code, ec.name)}</span>
                      </div>
                      <span className="font-semibold text-slate-500">
                        {ec.students} student{ec.students === 1 ? '' : 's'} · {ec.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )
      )}
    </div>
  );
}
