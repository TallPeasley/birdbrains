'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle, FileQuestion, RotateCcw, UploadCloud } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useRole } from '@/lib/roleContext';

export function Notice({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-4 text-sm text-slate-600">{children}</div>
    </div>
  );
}

/** Grey placeholder blocks shaped like the dashboard that is about to load. */
export function Loading({ variant = 'student' }: { variant?: 'student' | 'parent' }) {
  const block = 'rounded-2xl border border-slate-200 bg-slate-100';
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-slate-200" />
      </div>
      {variant === 'student' ? (
        <>
          <div className={`h-28 ${block}`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-32 ${block}`} />
            ))}
          </div>
          <div className={`h-72 ${block}`} />
        </>
      ) : (
        <>
          <div className={`h-20 ${block}`} />
          <div className={`h-80 ${block}`} />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`h-64 ${block}`} />
            <div className={`h-64 ${block}`} />
          </div>
        </>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Shown when a dashboard request fails. The button runs the request again. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Notice
      title={title}
      icon={
        <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="h-7 w-7" aria-hidden />
        </span>
      }
    >
      <p role="alert">{message}</p>
      <button onClick={onRetry} className={dark}>
        <RotateCcw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </Notice>
  );
}

const primary =
  'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700';
const dark =
  'inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800';

export function SignInNotice() {
  return (
    <Notice title="Sign in to see this dashboard">
      <Link href="/" className={primary}>
        Go to sign in
      </Link>
    </Notice>
  );
}

export function NoWorkNotice() {
  const { openCapture } = useRole();
  return (
    <Notice
      title="No graded work yet"
      icon={
        <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
          <FileQuestion className="h-7 w-7" aria-hidden />
        </span>
      }
    >
      <p>Take a photo of some handwritten math work and upload it. Your results will show up here.</p>
      <button onClick={openCapture} className={primary}>
        <UploadCloud className="h-4 w-4" aria-hidden /> Upload work
      </button>
    </Notice>
  );
}

/** Parents with no linked student enter the student's link code here. */
export function LinkChildForm() {
  const { linkChild } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Notice title="Link your child’s account">
      <p>Ask your child for the parent link code shown on their BirdBrains home page.</p>
      <form
        className="mx-auto flex max-w-xs gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          linkChild(code)
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false));
        }}
      >
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Link code"
          aria-label="Link code"
          maxLength={12}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center font-mono text-sm uppercase"
        />
        <button disabled={busy} className={`${primary} disabled:opacity-60`}>
          Link
        </button>
      </form>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
    </Notice>
  );
}

/** Shared gate for both dashboards. Returns a screen to show instead of data, or null to proceed. */
export function useDashboardGate(variant: 'student' | 'parent' = 'student'): React.ReactNode | null {
  const { ready, profile, activeStudentId } = useSession();
  if (!ready) return <Loading variant={variant} />;
  if (!profile) return <SignInNotice />;
  if (!activeStudentId) return <LinkChildForm />;
  return null;
}
