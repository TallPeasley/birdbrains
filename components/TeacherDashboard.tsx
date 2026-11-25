'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Crown,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Unlink,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Loading, SignInNotice } from '@/components/DashboardStates';
import MyStudents from '@/components/teacher/MyStudents';
import type {
  ClassroomCourse,
  ClassroomCoursework,
  ClassroomImportResult,
  GradeCourse,
  LmsProviderId,
  LmsProviderStatus,
  LmsSyncResult,
  RosterStudent,
} from '@/types/birdBrains';

const DEMO_PROVIDERS: LmsProviderStatus[] = [
  {
    id: 'google_classroom',
    name: 'Google Classroom',
    configured: true,
    connected: true,
    requiresInstanceUrl: false,
    defaultPlaceholder: '',
    plan: 'pro',
  },
  {
    id: 'brightspace',
    name: 'Brightspace (D2L)',
    configured: true,
    connected: false,
    requiresInstanceUrl: true,
    defaultPlaceholder: 'https://school.brightspace.com',
    plan: 'pro',
  },
  {
    id: 'canvas',
    name: 'Canvas LMS',
    configured: true,
    connected: false,
    requiresInstanceUrl: true,
    defaultPlaceholder: 'https://school.instructure.com',
    plan: 'pro',
  },
  {
    id: 'microsoft_edu',
    name: 'Microsoft Teams for Education',
    configured: true,
    connected: false,
    requiresInstanceUrl: false,
    defaultPlaceholder: '',
    plan: 'pro',
  },
];

const DEMO_COURSES: ClassroomCourse[] = [
  { id: 'demo_mpm2d', name: 'MPM2D · Principles of Mathematics', section: 'Period 2' },
  { id: 'demo_mth1w', name: 'MTH1W · Grade 9 De-streamed Math', section: 'Period 4' },
];

const DEMO_ASSIGNMENTS: ClassroomCoursework[] = [
  { id: 'demo_w1', title: 'Quadratics Factoring Check-In' },
  { id: 'demo_w2', title: 'Linear Systems Exit Ticket' },
];

const DEMO_ROSTER: RosterStudent[] = [
  { studentId: 'stu_demo_1', name: 'Ana Silva', course: 'MPM2D', lmsProvider: 'google_classroom', lmsCourseId: 'demo_mpm2d' },
  { studentId: 'stu_demo_2', name: 'Ben Okoro', course: 'MPM2D', lmsProvider: 'google_classroom', lmsCourseId: 'demo_mpm2d' },
];

function errText(err: unknown): string {
  if (err instanceof ApiError) return err.detail || `Error ${err.status}`;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export default function TeacherDashboard() {
  const { live, ready, signedIn, profile, getToken, setTesterView } = useSession();

  const [providers, setProviders] = useState<LmsProviderStatus[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [instanceUrls, setInstanceUrls] = useState<Record<string, string>>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  // Import & grade sync workflow state
  const [selectedProvider, setSelectedProvider] = useState<LmsProviderId>('google_classroom');
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [assignments, setAssignments] = useState<ClassroomCoursework[]>([]);
  const [selectedWork, setSelectedWork] = useState('');
  const [gradeCourse, setGradeCourse] = useState<GradeCourse>('MPM2D');
  const [unitTopic, setUnitTopic] = useState('Quadratics');

  const [coursesBusy, setCoursesBusy] = useState(false);
  const [workBusy, setWorkBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [gradeBusy, setGradeBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const [importResult, setImportResult] = useState<ClassroomImportResult | null>(null);
  const [gradedIds, setGradedIds] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<LmsSyncResult | null>(null);
  const [workflowError, setWorkflowError] = useState('');

  // Read OAuth redirect query params (?classroom=connected or ?lms=brightspace&status=connected)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classroomStatus = params.get('classroom');
    const lms = params.get('lms');
    const status = params.get('status');
    if (classroomStatus) {
      setBanner({
        tone: classroomStatus === 'connected' ? 'ok' : 'err',
        text:
          classroomStatus === 'connected'
            ? 'Google Classroom connected. You can now import classes and assignments.'
            : 'Google Classroom connection did not complete. Please try again.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (lms && status) {
      setBanner({
        tone: status === 'connected' ? 'ok' : 'err',
        text:
          status === 'connected'
            ? `${lms.replace('_', ' ')} connected. Select it below to import assignments.`
            : `${lms.replace('_', ' ')} connection failed. Check your URL and permissions and try again.`,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!live) {
      setProviders(DEMO_PROVIDERS);
      setRoster(DEMO_ROSTER);
      setLoading(false);
      return;
    }
    if (!signedIn || profile?.role !== 'teacher') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const [provs, students] = await Promise.all([api.lmsProviders(token), api.teacherStudents(token)]);
      setProviders(provs);
      setRoster(students);
      const firstConnected = provs.find((p) => p.connected);
      if (firstConnected) setSelectedProvider(firstConnected.id);
    } catch (err) {
      setBanner({ tone: 'err', text: errText(err) });
    } finally {
      setLoading(false);
    }
  }, [live, signedIn, profile?.role, getToken]);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const connectedProviders = useMemo(() => providers.filter((p) => p.connected), [providers]);

  const loadCourses = useCallback(
    async (pid: LmsProviderId) => {
      setCourses([]);
      setSelectedCourse('');
      setAssignments([]);
      setSelectedWork('');
      setImportResult(null);
      setSyncResult(null);
      setWorkflowError('');
      if (!live) {
        setCourses(DEMO_COURSES);
        setSelectedCourse(DEMO_COURSES[0].id);
        return;
      }
      setCoursesBusy(true);
      try {
        const token = await getToken();
        const rows =
          pid === 'google_classroom' ? await api.classroomCourses(token) : await api.lmsCourses(token, pid);
        setCourses(rows);
        if (rows[0]) setSelectedCourse(rows[0].id);
      } catch (err) {
        setWorkflowError(errText(err));
      } finally {
        setCoursesBusy(false);
      }
    },
    [live, getToken],
  );

  useEffect(() => {
    if (connectedProviders.some((p) => p.id === selectedProvider)) {
      void loadCourses(selectedProvider);
    } else {
      setCourses([]);
      setSelectedCourse('');
    }
  }, [selectedProvider, connectedProviders, loadCourses]);

  useEffect(() => {
    if (!selectedCourse) {
      setAssignments([]);
      setSelectedWork('');
      return;
    }
    if (!live) {
      setAssignments(DEMO_ASSIGNMENTS);
      setSelectedWork(DEMO_ASSIGNMENTS[0].id);
      return;
    }
    let cancelled = false;
    setWorkBusy(true);
    setWorkflowError('');
    void (async () => {
      try {
        const token = await getToken();
        const rows =
          selectedProvider === 'google_classroom'
            ? await api.classroomCoursework(token, selectedCourse)
            : await api.lmsAssignments(token, selectedProvider, selectedCourse);
        if (!cancelled) {
          setAssignments(rows);
          setSelectedWork(rows[0]?.id ?? '');
        }
      } catch (err) {
        if (!cancelled) setWorkflowError(errText(err));
      } finally {
        if (!cancelled) setWorkBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, selectedProvider, selectedCourse, getToken]);

  const handleConnect = async (p: LmsProviderStatus) => {
    if (!live) {
      setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, connected: true } : x)));
      setSelectedProvider(p.id);
      return;
    }
    setBusyProvider(p.id);
    setBanner(null);
    try {
      const token = await getToken();
      const { url } =
        p.id === 'google_classroom'
          ? await api.classroomConnect(token)
          : await api.lmsConnect(token, p.id, instanceUrls[p.id]);
      window.location.assign(url);
    } catch (err) {
      setBanner({ tone: 'err', text: errText(err) });
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (p: LmsProviderStatus) => {
    if (!live) {
      setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, connected: false } : x)));
      return;
    }
    setBusyProvider(p.id);
    try {
      const token = await getToken();
      if (p.id === 'google_classroom') await api.classroomDisconnect(token);
      else await api.lmsDisconnect(token, p.id);
      await refresh();
    } catch (err) {
      setBanner({ tone: 'err', text: errText(err) });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleImport = async () => {
    if (!selectedCourse || !selectedWork) return;
    setWorkflowError('');
    setImportResult(null);
    setGradedIds([]);
    setSyncResult(null);
    if (!live) {
      setImportResult({
        imported: [{ studentId: 'stu_demo_1', studentName: 'Ana Silva', submissionId: 'sub_demo_1' }],
        skipped: [{ studentName: 'Ben Okoro', reason: 'No photo attached (JPEG, PNG or WebP)' }],
      });
      return;
    }
    setImportBusy(true);
    try {
      const token = await getToken();
      const body = { course: gradeCourse, unitTopic: unitTopic.trim() || 'General Math' };
      const res =
        selectedProvider === 'google_classroom'
          ? await api.classroomImport(token, selectedCourse, selectedWork, body)
          : await api.lmsImport(token, selectedProvider, selectedCourse, selectedWork, body);
      setImportResult(res);
      await refresh();
    } catch (err) {
      setWorkflowError(errText(err));
    } finally {
      setImportBusy(false);
    }
  };

  const handleGradeAll = async () => {
    if (!importResult?.imported.length) return;
    setWorkflowError('');
    if (!live) {
      setGradedIds(importResult.imported.map((i) => i.submissionId));
      return;
    }
    setGradeBusy(true);
    try {
      const token = await getToken();
      const done: string[] = [];
      for (const item of importResult.imported) {
        await api.processSubmission(token, item.submissionId);
        done.push(item.submissionId);
      }
      setGradedIds(done);
    } catch (err) {
      setWorkflowError(errText(err));
    } finally {
      setGradeBusy(false);
    }
  };

  const handleSyncGrades = async () => {
    if (!selectedCourse || !selectedWork) return;
    setWorkflowError('');
    setSyncResult(null);
    if (!live) {
      setSyncResult({
        synced: [{ submissionId: 'sub_demo_1', studentName: 'Ana Silva', score: 8, maxScore: 10 }],
        skipped: [],
      });
      return;
    }
    setSyncBusy(true);
    try {
      const token = await getToken();
      const res =
        selectedProvider === 'google_classroom'
          ? await api.classroomSync(token, selectedCourse, selectedWork)
          : await api.lmsSync(token, selectedProvider, selectedCourse, selectedWork);
      setSyncResult(res);
    } catch (err) {
      setWorkflowError(errText(err));
    } finally {
      setSyncBusy(false);
    }
  };

  if (live && !ready) return <Loading />;
  if (live && !signedIn) return <SignInNotice />;
  if (live && profile && profile.role !== 'teacher') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Teacher Hub</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page is for teacher accounts. You are signed in as a {profile.role}.
          </p>
          {profile.tester ? (
            <button type="button" onClick={() => void setTesterView({ role: 'teacher' })} className="btn btn-primary mt-4">
              Switch to the teacher view
            </button>
          ) : (
            <Link href={`/${profile.role}`} className="btn-link mt-4 text-sm">
              Go to your dashboard <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (loading) return <Loading />;

  const isPro = !live || profile?.plan === 'pro';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Teacher dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {profile?.name ? `${profile.name.split(' ')[0]}’s class` : 'Your class'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Your students’ progress and uploads, plus Google Classroom, Brightspace, Canvas and Microsoft Teams import and grade sync.
          </p>
        </div>
        <Link
          href="/reports"
          className="btn btn-secondary"
        >
          <Users className="h-4 w-4" aria-hidden /> Class Reports
        </Link>
      </div>

      {banner && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {banner.text}
        </div>
      )}

      <MyStudents roster={roster} onRosterChange={setRoster} />

      <h2 className="pt-2 text-lg font-semibold text-slate-900">School & LMS integrations</h2>

      {!isPro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-950">LMS Import & Sync is a Pro Teacher feature</p>
              <p className="text-xs text-amber-800">Upgrade to Pro to connect your school LMS and import student submissions.</p>
            </div>
          </div>
          <Link href="/plans" className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700">
            View Plans
          </Link>
        </div>
      )}

      {/* Connected LMS Providers */}
      <section className="grid gap-4 sm:grid-cols-2">
        {providers.map((p) => (
          <div key={p.id} className="card flex flex-col justify-between gap-4 p-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">{p.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    p.connected
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : p.configured
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {p.connected ? 'Connected' : p.configured ? 'Not connected' : 'Not configured'}
                </span>
              </div>

              {p.requiresInstanceUrl && !p.connected && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600">School LMS URL</label>
                  <input
                    type="url"
                    placeholder={p.defaultPlaceholder}
                    value={instanceUrls[p.id] ?? p.instanceUrl ?? ''}
                    onChange={(e) => setInstanceUrls((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              {p.connected && p.instanceUrl && (
                <p className="mt-2 truncate text-xs text-slate-500">{p.instanceUrl}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {p.connected ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider(p.id)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                      selectedProvider === p.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selectedProvider === p.id ? 'Selected for Import' : 'Select'}
                  </button>
                  <button
                    type="button"
                    disabled={busyProvider === p.id}
                    onClick={() => void handleDisconnect(p)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Unlink className="h-3.5 w-3.5" aria-hidden /> Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!p.configured || !isPro || busyProvider === p.id || (p.requiresInstanceUrl && !(instanceUrls[p.id] ?? '').trim())}
                  onClick={() => void handleConnect(p)}
                  className="inline-flex w-full items-center justify-center gap-1.5 btn btn-sm btn-primary"
                >
                  {busyProvider === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
                  Connect {p.name}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Import & Grade Sync Workflow */}
      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import Assignments & Sync Grades</h2>
            <p className="text-xs text-slate-500">Pull student photo submissions from your connected LMS, grade with BirdBrains, and push scores back.</p>
          </div>
          {connectedProviders.length > 0 && (
            <button
              type="button"
              onClick={() => void loadCourses(selectedProvider)}
              disabled={coursesBusy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${coursesBusy ? 'animate-spin' : ''}`} aria-hidden /> Refresh
            </button>
          )}
        </div>

        {connectedProviders.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Connect an LMS above to browse courses and import student submissions.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">LMS Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                disabled={coursesBusy || courses.length === 0}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">Assignment</label>
              <select
                value={selectedWork}
                onChange={(e) => setSelectedWork(e.target.value)}
                disabled={workBusy || assignments.length === 0}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">BirdBrains Curriculum</label>
              <select
                value={gradeCourse}
                onChange={(e) => setGradeCourse(e.target.value as GradeCourse)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="MTH1W">Grade 9 · MTH1W</option>
                <option value="MPM2D">Grade 10 · MPM2D</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">Unit / Topic</label>
              <input
                value={unitTopic}
                onChange={(e) => setUnitTopic(e.target.value)}
                placeholder="e.g. Quadratics"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {workflowError && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {workflowError}
          </p>
        )}

        {connectedProviders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedCourse || !selectedWork || importBusy}
              onClick={() => void handleImport()}
              className="btn btn-primary"
            >
              {importBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              Import Submissions
            </button>

            {importResult && importResult.imported.length > 0 && (
              <button
                type="button"
                disabled={gradeBusy}
                onClick={() => void handleGradeAll()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {gradeBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                Grade {importResult.imported.length} Imported
              </button>
            )}

            {selectedProvider === 'google_classroom' ? (
              <p className="basis-full text-xs text-slate-500">
                Google only lets an app set grades on assignments that app created, so BirdBrains can’t send
                scores to Google Classroom. Copy each student’s score from their results into Classroom.
              </p>
            ) : (
            <button
              type="button"
              disabled={!selectedCourse || !selectedWork || syncBusy}
              onClick={() => void handleSyncGrades()}
              className="btn btn-secondary disabled:opacity-50"
            >
              {syncBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Sync Grades to LMS
            </button>
            )}
          </div>
        )}

        {importResult && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">
              Imported {importResult.imported.length} · Skipped {importResult.skipped.length}
              {gradedIds.length > 0 && ` · Graded ${gradedIds.length}`}
            </p>
            {importResult.skipped.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                {importResult.skipped.map((s, idx) => (
                  <li key={idx}>
                    {s.studentName}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {syncResult && (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-semibold">
                Synced {syncResult.synced.length} grade(s) to LMS · Skipped {syncResult.skipped.length}
              </p>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
