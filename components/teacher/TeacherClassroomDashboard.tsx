'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Crown,
  Download,
  ExternalLink,
  GraduationCap,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Unlink,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Loading, SignInNotice } from '@/components/DashboardStates';
import { MathText } from '@/components/MathText';
import type {
  ClassroomCourse,
  ClassroomCoursework,
  ClassroomImportResult,
  GradeCourse,
  PlanTier,
  RosterStudent,
  Stage2GradingAndAffectOutput,
} from '@/types/birdBrains';

const DEMO_COURSES: ClassroomCourse[] = [
  { id: 'gc_mpm2d_p2', name: 'MPM2D · Grade 10 Academic Math', section: 'Period 2' },
  { id: 'gc_mth1w_p4', name: 'MTH1W · Grade 9 De-streamed Math', section: 'Period 4' },
];

const DEMO_COURSEWORK: Record<string, ClassroomCoursework[]> = {
  gc_mpm2d_p2: [
    { id: 'cw_quad_1', title: 'Unit 3 · Completing the Square Exit Ticket' },
    { id: 'cw_quad_2', title: 'Unit 3 · Quadratic Formula Practice' },
  ],
  gc_mth1w_p4: [
    { id: 'cw_lin_1', title: 'Linear Relations · Slope-Intercept Quiz' },
  ],
};

const DEMO_ROSTER: RosterStudent[] = [
  { studentId: 'stu_demo_001', name: 'Alex Mercer', course: 'MPM2D', googleCourseId: 'gc_mpm2d_p2' },
  { studentId: 'stu_demo_002', name: 'Priya Patel', course: 'MPM2D', googleCourseId: 'gc_mpm2d_p2' },
  { studentId: 'stu_demo_003', name: 'Liam Chen', course: 'MTH1W', googleCourseId: 'gc_mth1w_p4' },
];

const DEMO_GRADING: Stage2GradingAndAffectOutput = {
  gradingId: 'grd_demo_teacher_1',
  submissionId: 'sub_demo_teacher_1',
  studentId: 'stu_demo_001',
  topic: 'Completing the Square · vertex form',
  totalScore: 8,
  maxPossibleScore: 10,
  affectState: 'PRODUCTIVE_STRUGGLE',
  supportiveFramingMessage: 'Solid setup on completing the square; watch the outer coefficient when moving -9 outside the bracket.',
  pillarBreakdowns: [
    { pillar: 'CON', maxScore: 3, earnedScore: 3, errorCount: 0, feedback: 'Clear grasp of vertex form structure.' },
    { pillar: 'PRC', maxScore: 3, earnedScore: 1.5, errorCount: 1, feedback: 'Missed multiplying -9 by 2 when removing from bracket.' },
    { pillar: 'FAC', maxScore: 2, earnedScore: 2, errorCount: 0, feedback: 'Accurate arithmetic throughout.' },
    { pillar: 'TST', maxScore: 2, earnedScore: 1.5, errorCount: 0, feedback: 'State the vertex coordinates explicitly.' },
  ],
  stepDiagnostics: [],
  entityExtractions: [
    { misconceptionId: 'PRC-03', description: 'Did not distribute leading coefficient to term removed from bracket.', severity: 'HIGH' },
  ],
  scaffoldingMode: 'STANDARD_PROGRESSIVE_FADE',
  plan: 'pro',
};

export default function TeacherClassroomDashboard() {
  const searchParams = useSearchParams();
  const classroomParam = searchParams.get('classroom');
  const { live, demo, ready, signedIn, profile, getToken } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoPlan, setDemoPlan] = useState<PlanTier>('pro');
  const [demoConnected, setDemoConnected] = useState(true);

  const [configured, setConfigured] = useState(true);
  const [plan, setPlan] = useState<PlanTier>('free');
  const [connected, setConnected] = useState(false);

  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [coursework, setCoursework] = useState<ClassroomCoursework[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [gradeCourse, setGradeCourse] = useState<GradeCourse>('MPM2D');
  const [unitTopic, setUnitTopic] = useState('');

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);
  const [studentGrading, setStudentGrading] = useState<Stage2GradingAndAffectOutput | null>(null);
  const [gradingLoading, setGradingLoading] = useState(false);

  const [connectBusy, setConnectBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importResult, setImportResult] = useState<ClassroomImportResult | null>(null);
  const [processedCount, setProcessedCount] = useState(0);

  const loadClassroomData = useCallback(async () => {
    setError('');
    if (!live) {
      setConfigured(true);
      setPlan(demoPlan);
      setConnected(demoConnected);
      if (demoPlan === 'pro' && demoConnected) {
        setCourses(DEMO_COURSES);
        setSelectedCourseId((prev) => prev || DEMO_COURSES[0].id);
        setRoster(DEMO_ROSTER);
      } else {
        setCourses([]);
        setRoster([]);
      }
      setLoading(false);
      return;
    }

    if (!signedIn) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const status = await api.classroomStatus(token);
      setConfigured(status.configured);
      setPlan(status.plan);
      setConnected(status.connected);

      if (status.plan === 'pro' && status.connected) {
        const [courseList, studentList] = await Promise.all([
          api.classroomCourses(token),
          api.teacherStudents(token),
        ]);
        setCourses(courseList);
        setRoster(studentList);
        if (courseList.length > 0) {
          setSelectedCourseId((prev) => prev || courseList[0].id);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConnected(false);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load Google Classroom status.');
      }
    } finally {
      setLoading(false);
    }
  }, [live, signedIn, getToken, demoPlan, demoConnected]);

  useEffect(() => {
    if (!ready) return;
    loadClassroomData();
  }, [ready, loadClassroomData]);

  useEffect(() => {
    if (!selectedCourseId || !connected || plan !== 'pro') {
      setCoursework([]);
      setSelectedWorkId('');
      return;
    }
    if (!live) {
      const items = DEMO_COURSEWORK[selectedCourseId] ?? [];
      setCoursework(items);
      setSelectedWorkId(items[0]?.id ?? '');
      if (items[0]) setUnitTopic(items[0].title);
      return;
    }
    let cancelled = false;
    getToken()
      .then((t) => api.classroomCoursework(t, selectedCourseId))
      .then((items) => {
        if (cancelled) return;
        setCoursework(items);
        setSelectedWorkId(items[0]?.id ?? '');
        if (items[0]) setUnitTopic(items[0].title);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 409) setConnected(false);
          else setError(err instanceof Error ? err.message : 'Could not load assignments.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, connected, plan, live, getToken]);

  async function handleConnect() {
    setError('');
    if (!live) {
      setDemoConnected(true);
      return;
    }
    setConnectBusy(true);
    try {
      const token = await getToken();
      const { url } = await api.classroomConnect(token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google Classroom connection.');
      setConnectBusy(false);
    }
  }

  async function handleDisconnect() {
    setError('');
    if (!live) {
      setDemoConnected(false);
      setCourses([]);
      setRoster([]);
      return;
    }
    setConnectBusy(true);
    try {
      const token = await getToken();
      await api.classroomDisconnect(token);
      setConnected(false);
      setCourses([]);
      setCoursework([]);
      setRoster([]);
      setImportResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect Google Classroom.');
    } finally {
      setConnectBusy(false);
    }
  }

  async function handleImportAndGrade() {
    if (!selectedCourseId || !selectedWorkId) return;
    setError('');
    setImportResult(null);
    setProcessedCount(0);
    setImportBusy(true);

    try {
      if (!live) {
        setImportProgress('Importing handed-in photos from Google Classroom…');
        await new Promise((r) => setTimeout(r, 500));
        const mockRes: ClassroomImportResult = {
          imported: [
            { studentId: 'stu_demo_001', studentName: 'Alex Mercer', submissionId: 'sub_demo_gc_1' },
            { studentId: 'stu_demo_002', studentName: 'Priya Patel', submissionId: 'sub_demo_gc_2' },
          ],
          skipped: [{ studentName: 'Sam Rivera', reason: 'Submitted a PDF (only JPEG, PNG, or WebP photos are supported)' }],
        };
        setImportResult(mockRes);
        for (let i = 0; i < mockRes.imported.length; i++) {
          setImportProgress(`Diagnosing ${i + 1} of ${mockRes.imported.length}: ${mockRes.imported[i].studentName}…`);
          await new Promise((r) => setTimeout(r, 450));
          setProcessedCount(i + 1);
        }
        setImportProgress('');
        return;
      }

      const token = await getToken();
      setImportProgress('Importing handed-in photos from Google Classroom…');
      const res = await api.classroomImport(token, selectedCourseId, selectedWorkId, {
        course: gradeCourse,
        unitTopic: unitTopic.trim() || 'Classroom Assignment',
      });
      setImportResult(res);

      for (let i = 0; i < res.imported.length; i++) {
        const item = res.imported[i];
        setImportProgress(`Diagnosing ${i + 1} of ${res.imported.length}: ${item.studentName}…`);
        await api.processSubmission(token, item.submissionId);
        setProcessedCount(i + 1);
      }

      const updatedRoster = await api.teacherStudents(token);
      setRoster(updatedRoster);
      setImportProgress('');
    } catch (err) {
      setImportProgress('');
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setImportBusy(false);
    }
  }

  async function handleSelectStudent(student: RosterStudent) {
    setSelectedStudent(student);
    setStudentGrading(null);
    setGradingLoading(true);
    try {
      if (!live) {
        setStudentGrading({ ...DEMO_GRADING, studentId: student.studentId });
        return;
      }
      const token = await getToken();
      const latest = await api.latestGrading(token, student.studentId);
      setStudentGrading(latest);
    } catch {
      setStudentGrading(null);
    } finally {
      setGradingLoading(false);
    }
  }

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

  if (live && profile && profile.role !== 'teacher') {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-indigo-600" aria-hidden />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Teacher account required</h1>
        <p className="mt-2 text-sm text-slate-600">
          Google Classroom import is only available on teacher accounts.
        </p>
        <Link href="/student" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Teacher · Pro</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Google Classroom Import
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connect your Google Classroom, import handed-in math photos, and run 4-pillar diagnostics for your class.
          </p>
        </div>

        {!live && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <span className="font-semibold text-slate-500">Demo view:</span>
            <button
              type="button"
              onClick={() => setDemoPlan('pro')}
              className={`rounded-lg px-2.5 py-1 font-semibold ${demoPlan === 'pro' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Pro Teacher
            </button>
            <button
              type="button"
              onClick={() => setDemoPlan('free')}
              className={`rounded-lg px-2.5 py-1 font-semibold ${demoPlan === 'free' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Free Plan
            </button>
          </div>
        )}
      </header>

      {classroomParam === 'connected' && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          Google Classroom connected! Pick a class and assignment below to import student work.
        </div>
      )}

      {classroomParam === 'failed' && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
          Google Classroom authorization did not complete. Please try connecting again.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {plan !== 'pro' ? (
        <section className="card border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                <Crown className="h-3.5 w-3.5" aria-hidden /> Pro Teacher Feature
              </span>
              <h2 className="text-xl font-bold text-slate-900">Upgrade to Pro to connect Google Classroom</h2>
              <p className="max-w-xl text-sm text-slate-600">
                Import student photo submissions directly from your Google Classroom assignments, grade them with 4-pillar error codes, and generate class mastery reports.
              </p>
            </div>
            <Link
              href="/plans"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> View Pro Plan
            </Link>
          </div>
        </section>
      ) : !configured ? (
        <section className="card p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Google Classroom integration is not configured on this server yet.
          </p>
        </section>
      ) : !connected ? (
        <section className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">Connect your Google Classroom</h2>
              <p className="max-w-xl text-sm text-slate-600">
                Sign in with Google to read your classes and student photo submissions. BirdBrains never posts grades back without your review.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connectBusy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {connectBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
              Connect Google Classroom
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Connected import workflow */}
          <section className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <BookOpen className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Import Assignment Submissions</h2>
                  <p className="text-xs text-slate-500">JPEG, PNG, and WebP photos are imported and diagnosed automatically.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadClassroomData}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={connectBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <Unlink className="h-3.5 w-3.5" aria-hidden /> Disconnect
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="font-semibold text-slate-700">Google Classroom</span>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {courses.length === 0 && <option value="">No classes found</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.section ? ` (${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-semibold text-slate-700">Assignment</span>
                <select
                  value={selectedWorkId}
                  onChange={(e) => {
                    setSelectedWorkId(e.target.value);
                    const found = coursework.find((w) => w.id === e.target.value);
                    if (found) setUnitTopic(found.title);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {coursework.length === 0 && <option value="">No assignments found</option>}
                  {coursework.map((w) => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-semibold text-slate-700">Ontario Course</span>
                <select
                  value={gradeCourse}
                  onChange={(e) => setGradeCourse(e.target.value as GradeCourse)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="MTH1W">MTH1W (Grade 9)</option>
                  <option value="MPM2D">MPM2D (Grade 10)</option>
                </select>
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-semibold text-slate-700">Topic Label</span>
                <input
                  type="text"
                  value={unitTopic}
                  onChange={(e) => setUnitTopic(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Completing the Square"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleImportAndGrade}
                disabled={importBusy || !selectedCourseId || !selectedWorkId}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                Import &amp; Diagnose Submissions
              </button>

              {importProgress && (
                <span className="text-xs font-medium text-indigo-700" aria-live="polite">
                  {importProgress}
                </span>
              )}
            </div>

            {importResult && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">
                  Imported {importResult.imported.length} photo{importResult.imported.length === 1 ? '' : 's'}
                  {processedCount > 0 ? ` (${processedCount} diagnosed)` : ''}
                </p>
                {importResult.skipped.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Skipped</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {importResult.skipped.map((s, idx) => (
                        <li key={idx}>
                          <span className="font-medium text-slate-800">{s.studentName}:</span> {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Imported Roster & Results */}
          <section className="grid gap-6 lg:grid-cols-5">
            <div className="card space-y-3 p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Users className="h-4 w-4 text-indigo-600" aria-hidden /> Imported Students
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {roster.length}
                </span>
              </div>

              {roster.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No students imported yet. Import an assignment above to populate your roster.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {roster.map((student) => {
                    const active = selectedStudent?.studentId === student.studentId;
                    return (
                      <li key={student.studentId}>
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(student)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold">{student.name}</p>
                            <p className="text-xs text-slate-500">{student.course}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="card p-5 lg:col-span-3">
              {!selectedStudent ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-sm text-slate-500">
                  <GraduationCap className="mb-2 h-8 w-8 text-slate-300" aria-hidden />
                  Select a student from your roster to inspect their latest diagnostic.
                </div>
              ) : gradingLoading ? (
                <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading latest diagnostic…
                </div>
              ) : !studentGrading ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center text-center text-sm text-slate-500">
                  No graded work yet for {selectedStudent.name}.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{selectedStudent.course}</p>
                      <h3 className="text-lg font-bold text-slate-900">{selectedStudent.name}</h3>
                      <p className="text-xs text-slate-500">
                        <MathText text={studentGrading.topic} />
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-slate-900">
                        {studentGrading.totalScore}/{studentGrading.maxPossibleScore}
                      </span>
                      <p className="text-xs text-slate-500">Latest Score</p>
                    </div>
                  </div>

                  <p className="rounded-xl bg-indigo-50/70 p-3 text-sm text-slate-700">
                    <MathText text={studentGrading.supportiveFramingMessage} />
                  </p>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {studentGrading.pillarBreakdowns.map((p) => (
                      <div key={p.pillar} className="rounded-xl border border-slate-200 p-3 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{p.pillar}</span>
                          <span>{p.earnedScore}/{p.maxScore}</span>
                        </div>
                        <p className="mt-1 text-slate-600">
                          <MathText text={p.feedback} />
                        </p>
                      </div>
                    ))}
                  </div>

                  {studentGrading.entityExtractions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected Error Codes</p>
                      <div className="flex flex-wrap gap-2">
                        {studentGrading.entityExtractions.map((e, i) => (
                          <span key={i} className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
                            {e.misconceptionId}: <MathText text={e.description} />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-1">
                    <Link
                      href={`/student?studentId=${encodeURIComponent(selectedStudent.studentId)}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Open full student view <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
