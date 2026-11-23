'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Repeat, UserMinus, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { mistakeName } from '@/lib/errorCodes';
import { useSession } from '@/lib/session';
import StudentProgressPanel from '@/components/StudentProgressPanel';
import UploadHistory from '@/components/account/UploadHistory';
import type { ProgressReport, RosterStudent } from '@/types/birdBrains';

const SOURCE: Record<string, string> = {
  google_classroom: 'Google Classroom',
  brightspace: 'Brightspace',
  canvas: 'Canvas',
  microsoft_edu: 'Microsoft Teams',
};

function source(s: RosterStudent): string {
  if (s.linkedAccount) return 'Added with link code';
  return SOURCE[s.lmsProvider ?? ''] ?? (s.googleCourseId ? 'Google Classroom' : 'Imported');
}

function errText(err: unknown): string {
  if (err instanceof ApiError) return err.detail || `Error ${err.status}`;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/**
 * The teacher's students: add one with their link code (no LMS needed), see each
 * student's uploads, mastery and repeat mistakes, and open a student to see their
 * progress and every graded upload.
 */
export default function MyStudents({
  roster,
  onRosterChange,
}: {
  roster: RosterStudent[];
  onRosterChange: (next: RosterStudent[]) => void;
}) {
  const { live, getToken, dataVersion } = useSession();
  const [reports, setReports] = useState<Record<string, ProgressReport | 'error'>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!live || roster.length === 0) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      // A few at a time, so a big class doesn't fire dozens of requests at once.
      for (let i = 0; i < roster.length; i += 4) {
        const batch = roster.slice(i, i + 4);
        const got = await Promise.all(
          batch.map((s) =>
            api.progress(token, s.studentId).then(
              (r) => [s.studentId, r] as const,
              () => [s.studentId, 'error'] as const,
            ),
          ),
        );
        if (cancelled) return;
        setReports((prev) => ({ ...prev, ...Object.fromEntries(got) }));
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [live, roster, getToken, dataVersion]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!live) return;
    setBusy(true);
    setError('');
    try {
      onRosterChange(await api.addRosterStudent(await getToken(), code.trim()));
      setCode('');
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: RosterStudent) => {
    if (!live || !window.confirm(`Take ${s.name} off your list? Their account and work are kept.`)) return;
    try {
      onRosterChange(await api.removeRosterStudent(await getToken(), s.studentId));
      setOpen(null);
    } catch (err) {
      setError(errText(err));
    }
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="my-students-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="my-students-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Users className="h-5 w-5 text-indigo-600" aria-hidden /> Your students ({roster.length})
          </h2>
          <p className="text-sm text-slate-500">
            Open a student to see their progress and every upload. Students you import from a class list show up here too.
          </p>
        </div>
        <form onSubmit={add} className="flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Student link code"
            aria-label="Student link code"
            maxLength={12}
            minLength={6}
            required
            className="w-40 rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
          />
          <button disabled={busy || !live} className="btn btn-primary btn-sm disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
            Add
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        A student finds their link code on their Account page (the same code they give a parent).
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {roster.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No students yet. Add one with their link code, or import a class from your LMS below.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {roster.map((s) => {
            const r = reports[s.studentId];
            const rep = r && r !== 'error' ? r : null;
            const top = rep ? [...rep.errorCodes].sort((a, b) => b.count - a.count)[0] : undefined;
            const isOpen = open === s.studentId;
            return (
              <li key={s.studentId}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : s.studentId)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[1.4fr_0.7fr_0.8fr_1.6fr_auto]"
                >
                  <span>
                    <span className="block font-medium text-slate-900">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      {s.course} · {source(s)}
                    </span>
                  </span>
                  <span className="hidden text-sm text-slate-700 sm:block">
                    {rep ? `${rep.uploads} ${rep.uploads === 1 ? 'upload' : 'uploads'}` : live && !r ? '…' : ''}
                  </span>
                  <span className="hidden text-sm text-slate-700 sm:block">
                    {rep?.averageMastery != null ? `${Math.round(rep.averageMastery * 100)}% mastery` : ''}
                  </span>
                  <span className="hidden items-center gap-1.5 text-sm text-slate-700 sm:flex">
                    {top && (
                      <>
                        {rep?.recurringCodes.includes(top.code) && <Repeat className="h-3.5 w-3.5 text-amber-600" aria-label="keeps coming back" />}
                        {mistakeName(top.code, top.name)}
                      </>
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
                    {rep ? (
                      <StudentProgressPanel report={rep} showReportLink={false} />
                    ) : r === 'error' ? (
                      <p className="text-sm text-rose-700">Could not load this student’s progress.</p>
                    ) : live ? (
                      <p className="text-sm text-slate-500">Loading progress…</p>
                    ) : (
                      <p className="text-sm text-slate-500">Sample student: sign in as a teacher to see real progress.</p>
                    )}
                    {live && <UploadHistory studentId={s.studentId} />}
                    {s.linkedAccount && live && (
                      <button type="button" onClick={() => remove(s)} className="btn btn-secondary btn-sm">
                        <UserMinus className="h-4 w-4" aria-hidden /> Take off my list
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
