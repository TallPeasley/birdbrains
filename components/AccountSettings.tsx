'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  GraduationCap,
  Link2,
  Loader2,
  LogOut,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import rawMocks from '@/mocks/birdBrainsMockData.json';
import { parentSummary as demoParentSummary } from '@/lib/mockData';
import { api, ApiError } from '@/lib/api';
import { useRole } from '@/lib/roleContext';
import { useSession } from '@/lib/session';
import { Loading, SignInNotice } from '@/components/DashboardStates';
import type { ApiClass, UserProfile } from '@/types/birdBrains';

const DEMO_PROFILES = rawMocks.demoProfiles as {
  student: UserProfile;
  parent: UserProfile;
};
const DEMO_CLASSES = rawMocks.demoClasses as ApiClass[];

function formatApiError(err: unknown, fallback404?: string, fallback403?: string): string {
  if (err instanceof ApiError) {
    if (err.detail && err.detail.trim() !== '') return err.detail;
    if (err.status === 404 && fallback404) return fallback404;
    if (err.status === 403 && fallback403) return fallback403;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

export default function AccountSettings() {
  const router = useRouter();
  const { role } = useRole();
  const {
    live,
    demo,
    setDemo,
    ready,
    profile,
    activeStudentId,
    setActiveStudentId,
    linkChild,
    signOut,
    getToken,
  } = useSession();

  const [copied, setCopied] = useState(false);

  // Parent: link another child state
  const [childCode, setChildCode] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  // Student: classes state
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesLoadError, setClassesLoadError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinNotice, setJoinNotice] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // Delete my data state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'me' | string>('me');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteDemoNotice, setDeleteDemoNotice] = useState('');

  // Sign out state
  const [signOutBusy, setSignOutBusy] = useState(false);

  const activeProfile: UserProfile | null = live
    ? profile
    : role === 'parent'
      ? DEMO_PROFILES.parent
      : DEMO_PROFILES.student;

  useEffect(() => {
    setLinkError('');
    setLinkSuccess('');
    setJoinError('');
    setJoinNotice('');
    setDeleteError('');
    setDeleteDemoNotice('');
    setShowDeleteConfirm(false);
    setDeleteInput('');
    setDeleteTarget('me');
  }, [role, live, profile?.uid]);

  useEffect(() => {
    if (!live || !profile || profile.role !== 'student') {
      setClasses([]);
      setClassesLoading(false);
      setClassesLoadError('');
      return;
    }
    let cancelled = false;
    setClassesLoading(true);
    setClassesLoadError('');
    getToken()
      .then((token) => api.myClasses(token))
      .then((list) => {
        if (!cancelled) setClasses(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setClassesLoadError(formatApiError(err));
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, profile, getToken]);

  if (live && !ready) {
    return <Loading variant={role} />;
  }

  if (live && !activeProfile) {
    return <SignInNotice />;
  }

  if (!activeProfile) {
    return <SignInNotice />;
  }

  const isStudent = activeProfile.role === 'student';
  const displayedClasses = live ? classes : isStudent ? DEMO_CLASSES : [];

  const handleCopyCode = async () => {
    if (!activeProfile.linkCode) return;
    try {
      await navigator.clipboard.writeText(activeProfile.linkCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = childCode.trim().toUpperCase();
    if (!cleaned) return;
    setLinkError('');
    setLinkSuccess('');

    if (!live) {
      setChildCode('');
      setLinkSuccess(
        `Demo mode: checked code ${cleaned}. In a live account, this links the student to your parent dashboard.`,
      );
      return;
    }

    setLinkBusy(true);
    try {
      await linkChild(cleaned);
      setChildCode('');
      setLinkSuccess('Child account linked.');
    } catch (err: unknown) {
      setLinkError(
        formatApiError(
          err,
          'That link code was not recognised.',
          'Only parent accounts can link a student.',
        ),
      );
    } finally {
      setLinkBusy(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) return;
    setJoinError('');
    setJoinNotice('');

    if (!live) {
      setJoinCode('');
      setJoinNotice(
        `Demo mode: checked class code ${cleaned}. Nothing is saved in the demo.`,
      );
      return;
    }

    setJoinBusy(true);
    try {
      const token = await getToken();
      const updated = await api.joinClass(token, cleaned);
      setClasses(updated);
      setJoinCode('');
      setJoinNotice('Joined class.');
    } catch (err: unknown) {
      setJoinError(
        formatApiError(
          err,
          'That class code was not recognised.',
          'Only student accounts can join a class.',
        ),
      );
    } finally {
      setJoinBusy(false);
    }
  };

  const handleLeaveClass = async (classId: string) => {
    setJoinError('');
    setJoinNotice('');
    if (!live) {
      setJoinNotice('Demo mode: sample classes stay unchanged.');
      return;
    }
    setLeavingId(classId);
    try {
      const token = await getToken();
      const updated = await api.leaveClass(token, classId);
      setClasses(updated);
      setJoinNotice('Left class.');
    } catch (err: unknown) {
      setJoinError(formatApiError(err));
    } finally {
      setLeavingId(null);
    }
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteInput !== 'DELETE') return;
    setDeleteError('');
    setDeleteDemoNotice('');

    if (!live) {
      setShowDeleteConfirm(false);
      setDeleteInput('');
      setDeleteDemoNotice(
        'Demo mode: confirmation complete. Sample data was not deleted.',
      );
      return;
    }

    setDeleteBusy(true);
    try {
      const token = await getToken();
      if (deleteTarget === 'me') {
        await api.deleteMe(token);
        await signOut();
        router.push('/');
      } else {
        await api.deleteStudentData(token, deleteTarget);
        await signOut();
        router.push('/');
      }
    } catch (err: unknown) {
      setDeleteError(formatApiError(err, 'Account or student record was not found.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!live) {
      setDemo(false);
      router.push('/');
      return;
    }
    setSignOutBusy(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setSignOutBusy(false);
    }
  };

  const courseDisplay =
    activeProfile.course === 'MPM2D'
      ? 'Grade 10 · MPM2D'
      : activeProfile.course === 'MTH1W'
        ? 'Grade 9 · MTH1W'
        : activeProfile.course ?? 'Not set';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Account &amp; settings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {activeProfile.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {demo
              ? `Viewing sample ${isStudent ? 'student' : 'parent'} settings. Switch views in the top bar to preview both roles.`
              : 'Manage your profile details, family links, classes, and stored data.'}
          </p>
        </div>
        <Link
          href={`/${activeProfile.role}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </header>

      {/* Profile section (read-only) */}
      <section className="card p-5 sm:p-6" aria-labelledby="profile-heading">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="profile-heading" className="text-lg font-semibold text-slate-900">
              Profile
            </h2>
            <p className="text-sm text-slate-500">
              Your account details are read-only. Your role is set when you sign up and cannot be changed.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            {isStudent ? (
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Users className="h-3.5 w-3.5" aria-hidden />
            )}
            {isStudent ? 'Student' : 'Parent'}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</dt>
            <dd className="mt-1 text-base font-semibold text-slate-900">{activeProfile.name}</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</dt>
            <dd className="mt-1 text-base font-semibold capitalize text-slate-900">
              {activeProfile.role}
            </dd>
          </div>

          {isStudent && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Course</dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">{courseDisplay}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Student: Parent link code */}
      {isStudent && activeProfile.linkCode && (
        <section className="card p-5 sm:p-6" aria-labelledby="link-code-heading">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-600" aria-hidden />
            <h2 id="link-code-heading" className="text-lg font-semibold text-slate-900">
              Parent link code
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            A parent enters this on their dashboard to follow your progress.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Your code
              </span>
              <span className="mt-0.5 block font-mono text-xl font-bold tracking-wider text-slate-900">
                {activeProfile.linkCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-600" aria-hidden />
                  Copy code
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Parent: Linked children and Link another child form */}
      {!isStudent && (
        <section className="card p-5 sm:p-6" aria-labelledby="children-heading">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" aria-hidden />
            <h2 id="children-heading" className="text-lg font-semibold text-slate-900">
              Linked children
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Students linked to your parent account. Enter a student&apos;s parent link code below to add another child.
          </p>

          {activeProfile.childStudentIds.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No children linked yet. Ask your child for the parent link code from their account page.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {activeProfile.childStudentIds.map((childId, idx) => {
                const isDemoAlex = !live && childId === demoParentSummary.studentId;
                const isSelected = (activeStudentId ?? activeProfile.childStudentIds[0]) === childId;
                return (
                  <li
                    key={childId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {isDemoAlex ? demoParentSummary.studentName : `Child ${idx + 1}`}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {isDemoAlex ? `Grade 10 · ${demoParentSummary.course} · ` : ''}
                        <span className="font-mono">{childId}</span>
                      </p>
                    </div>
                    {activeProfile.childStudentIds.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveStudentId(childId)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? 'Showing on dashboard' : 'Show on dashboard'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        Linked
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={(e) => void handleLinkChild(e)} className="mt-5 border-t border-slate-200 pt-4">
            <label htmlFor="link-child-code" className="block text-sm font-semibold text-slate-900">
              Link another child
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Enter the 8-character parent link code shown on your child&apos;s account screen.
            </p>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="link-child-code"
                type="text"
                required
                maxLength={12}
                value={childCode}
                onChange={(e) => setChildCode(e.target.value.toUpperCase())}
                placeholder="e.g. DBLE7QA2"
                aria-label="Parent link code"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase tracking-wider sm:max-w-xs"
              />
              <button
                type="submit"
                disabled={linkBusy || childCode.trim() === ''}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Link child
              </button>
            </div>
            {linkError && (
              <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {linkError}
              </p>
            )}
            {linkSuccess && (
              <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {linkSuccess}
              </p>
            )}
          </form>
        </section>
      )}

      {/* Join a class */}
      <section className="card p-5 sm:p-6" aria-labelledby="classes-heading">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" aria-hidden />
          <h2 id="classes-heading" className="text-lg font-semibold text-slate-900">
            Join a class
          </h2>
        </div>

        {isStudent ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Enter the 6-character class code from your teacher to connect your account to your school class.
            </p>

            {classesLoading ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading your classes…
              </p>
            ) : classesLoadError ? (
              <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {classesLoadError}
              </p>
            ) : displayedClasses.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {displayedClasses.map((cls) => (
                  <li
                    key={cls.classId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{cls.className}</p>
                      <p className="text-xs text-slate-500">
                        Grade {cls.gradeLevel}
                        {cls.schoolName ? ` · ${cls.schoolName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={leavingId === cls.classId}
                      onClick={() => void handleLeaveClass(cls.classId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {leavingId === cls.classId ? 'Leaving…' : 'Leave class'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-600">
                You haven&apos;t joined a class yet.
              </p>
            )}

            <form onSubmit={(e) => void handleJoinClass(e)} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="join-class-code" className="sr-only">
                Class code
              </label>
              <input
                id="join-class-code"
                type="text"
                required
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="6-letter code"
                aria-label="Class code"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm uppercase tracking-wider sm:max-w-xs"
              />
              <button
                type="submit"
                disabled={joinBusy || joinCode.trim() === ''}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joinBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Join class
              </button>
            </form>

            {joinError && (
              <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {joinError}
              </p>
            )}
            {joinNotice && (
              <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {joinNotice}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Students join classes from their own account using a 6-character class code from their teacher.
          </p>
        )}
      </section>

      {/* Delete my data */}
      <section className="card border-rose-200 p-5 sm:p-6" aria-labelledby="delete-heading">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-rose-600" aria-hidden />
          <h2 id="delete-heading" className="text-lg font-semibold text-slate-900">
            Delete my data
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {isStudent
            ? 'Permanently deletes your account, uploaded work photos, diagnostics, and practice worksheets.'
            : 'Permanently delete your parent account, or delete all stored photos, diagnostics, worksheets, and account data for a linked child.'}
        </p>

        {deleteDemoNotice && (
          <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {deleteDemoNotice}
          </p>
        )}

        {!showDeleteConfirm ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteInput('');
                setDeleteError('');
                setDeleteDemoNotice('');
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete my data
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleDeleteConfirm(e)}
            className="mt-4 space-y-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4"
          >
            <div className="flex items-start gap-2.5 text-sm text-rose-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
              <div>
                <p className="font-semibold">This cannot be undone.</p>
                <p className="mt-0.5 text-rose-800">
                  Type <span className="font-mono font-bold">DELETE</span> in the box below to confirm.
                </p>
              </div>
            </div>

            {!isStudent && activeProfile.childStudentIds.length > 0 && (
              <div>
                <label htmlFor="delete-target" className="block text-xs font-semibold uppercase tracking-wider text-rose-800">
                  What to delete
                </label>
                <select
                  id="delete-target"
                  value={deleteTarget}
                  onChange={(e) => setDeleteTarget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 sm:max-w-sm"
                >
                  <option value="me">My parent account only</option>
                  {activeProfile.childStudentIds.map((id, i) => (
                    <option key={id} value={id}>
                      All data &amp; account for {!live && id === demoParentSummary.studentId ? demoParentSummary.studentName : `Child ${i + 1}`} ({id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="confirm-delete-input" className="block text-xs font-semibold uppercase tracking-wider text-rose-800">
                Type DELETE to confirm
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 sm:max-w-xs"
              />
            </div>

            {deleteError && (
              <p role="alert" className="rounded-xl bg-white px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {deleteError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={deleteBusy || deleteInput !== 'DELETE'}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Permanently delete
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput('');
                  setDeleteError('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Sign out */}
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6" aria-label="Sign out">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {live ? 'Sign out of BirdBrains' : 'Exit demo mode'}
          </h2>
          <p className="text-sm text-slate-500">
            {live
              ? 'You can sign back in anytime with your email and password.'
              : 'Return to the home page.'}
          </p>
        </div>
        <button
          type="button"
          disabled={signOutBusy}
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
        >
          {signOutBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden />
          )}
          Sign out
        </button>
      </section>
    </div>
  );
}
