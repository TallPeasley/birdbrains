'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ExternalLink, Link2, Loader2, Unlink, UploadCloud } from 'lucide-react';
import ClassroomBetaSignup from '@/components/ClassroomBetaSignup';
import { api, ApiError } from '@/lib/api';
import { useRole } from '@/lib/roleContext';
import { useSession } from '@/lib/session';
import type { ClassroomBetaStatus, ClassroomCourse, ClassroomStudentWork, PlanTier } from '@/types/birdBrains';

interface Status {
  configured: boolean;
  plan: PlanTier;
  connected: boolean;
  beta: ClassroomBetaStatus;
}

function errText(err: unknown): string {
  if (err instanceof ApiError) return err.detail || `Error ${err.status}`;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

const STATE_LABEL: Record<string, string> = {
  CREATED: 'Not handed in',
  NEW: 'Not handed in',
  TURNED_IN: 'Handed in, not graded yet',
  RETURNED: 'Returned',
  RECLAIMED_BY_STUDENT: 'Unsubmitted',
};

/**
 * Google Classroom for students (beta, Pro). Once connected, each assignment shows the
 * teacher's grade and what the teacher asked for, and has its own upload: the test is
 * then graded for learning with the teacher's instructions and rubric in mind.
 */
export default function ClassroomPanel() {
  const { live, profile, getToken, dataVersion } = useSession();
  const { openCapture } = useRole();
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [work, setWork] = useState<ClassroomStudentWork[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const isStudent = live && profile?.role === 'student';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('classroom');
    if (!result) return;
    setNote(
      result === 'connected'
        ? { tone: 'ok', text: 'Google Classroom connected. Your classes and grades are below.' }
        : { tone: 'err', text: 'Google Classroom did not connect. Please try again.' },
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const loadStatus = useCallback(async () => {
    if (!isStudent) return;
    try {
      setStatus(await api.classroomStatus(await getToken()));
    } catch {
      setStatus(null);
    }
  }, [isStudent, getToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.connected) return;
    void (async () => {
      try {
        const rows = await api.classroomMyCourses(await getToken());
        setCourses(rows);
        setCourseId((c) => c || rows[0]?.id || '');
      } catch (err) {
        setNote({ tone: 'err', text: errText(err) });
      }
    })();
  }, [status?.connected, getToken]);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setWork(null);
    void (async () => {
      try {
        const rows = await api.classroomMyWork(await getToken(), courseId);
        if (!cancelled) setWork(rows);
      } catch (err) {
        if (!cancelled) {
          setWork([]);
          setNote({ tone: 'err', text: errText(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // dataVersion: refresh after an upload so the assignment shows it.
  }, [courseId, getToken, dataVersion]);

  if (!isStudent || !status) return null;

  const run = async (fn: (token: string) => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn(await getToken());
    } catch (err) {
      setNote({ tone: 'err', text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (status.plan !== 'pro') return null; // Pro only; Free students don't see the beta at all
  if (status.beta !== 'approved') {
    body = (
      <ClassroomBetaSignup
        status={status.beta}
        email={email}
        onEmail={setEmail}
        busy={busy}
        onJoin={() =>
          void run(async (t) => {
            const res = await api.classroomBetaJoin(t, email.trim());
            setStatus({ ...status, beta: res.beta });
          })
        }
      />
    );
  } else if (!status.connected) {
    body = status.configured ? (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async (t) => {
            const { url } = await api.classroomConnect(t);
            window.location.assign(url);
          })
        }
        className="btn btn-primary btn-sm"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        Connect Google Classroom
      </button>
    ) : (
      <p className="text-sm text-slate-600">You’re in the test group. Google Classroom will switch on here soon.</p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="classroom-course">
            Class
          </label>
          <select
            id="classroom-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` · ${c.section}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async (t) => {
                await api.classroomDisconnect(t);
                setCourses([]);
                setCourseId('');
                setWork(null);
                await loadStatus();
              })
            }
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <Unlink className="h-3.5 w-3.5" aria-hidden /> Disconnect
          </button>
        </div>
        {courses.length === 0 && <p className="text-sm text-slate-500">No active classes found in Google Classroom.</p>}
        {courseId && work === null && <p className="text-sm text-slate-500">Loading assignments…</p>}
        {work && work.length === 0 && <p className="text-sm text-slate-500">No assignments in this class yet.</p>}
        {work && work.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {work.map((w) => {
              const expanded = open === w.id;
              const hasExpectations = Boolean(w.description.trim()) || w.rubric.length > 0;
              return (
                <li key={w.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{w.title}</p>
                      <p className="text-xs text-slate-500">
                        {w.assignedGrade !== null
                          ? `Your grade: ${w.assignedGrade}${w.maxPoints ? ` / ${w.maxPoints}` : ''}`
                          : (STATE_LABEL[w.state ?? ''] ?? 'Not graded yet')}
                        {w.dueDate ? ` · due ${w.dueDate}` : ''}
                      </p>
                    </div>
                    {w.submissionId ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        {w.gradingId ? 'Feedback ready in your uploads' : 'Uploaded'}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        openCapture({ classroomCourseId: courseId, classroomWorkId: w.id, problem: w.title })
                      }
                      className="btn btn-sm btn-secondary"
                    >
                      <UploadCloud className="h-4 w-4" aria-hidden />
                      {w.submissionId ? 'Upload again' : 'Upload this test'}
                    </button>
                  </div>
                  {hasExpectations && (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : w.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                      What your teacher asked for
                    </button>
                  )}
                  {expanded && (
                    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      {w.description.trim() && <p className="whitespace-pre-line">{w.description}</p>}
                      {w.rubric.length > 0 && (
                        <ul className="space-y-1">
                          {w.rubric.map((c, i) => (
                            <li key={i}>
                              <span className="font-medium">{c.title}</span>
                              {c.description ? `: ${c.description}` : ''}
                              {c.levels.length > 0 && (
                                <span className="text-slate-500">
                                  {' '}
                                  ({c.levels.map((l) => (l.points !== null ? `${l.title} ${l.points}` : l.title)).join(', ')})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {w.link && (
                        <a href={w.link} target="_blank" rel="noreferrer" className="btn-link inline-flex items-center gap-1 text-xs">
                          Open in Classroom <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="classroom-title">
      <div className="flex items-center gap-2">
        <h2 id="classroom-title" className="text-base font-semibold text-slate-900">
          Google Classroom
        </h2>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
          Beta
        </span>
      </div>
      {note && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${note.tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}
        >
          {note.text}
        </p>
      )}
      {body}
    </section>
  );
}
