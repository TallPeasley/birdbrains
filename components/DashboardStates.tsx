'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useRole } from '@/lib/roleContext';

export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-4 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
    </div>
  );
}

const primary = 'inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700';

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
    <Notice title="No graded work yet">
      <p>Upload a photo of handwritten math work and the diagnostic will appear here.</p>
      <button onClick={openCapture} className={primary}>
        Upload work
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
export function useDashboardGate(): React.ReactNode | null {
  const { ready, profile, activeStudentId } = useSession();
  if (!ready) return <Loading />;
  if (!profile) return <SignInNotice />;
  if (!activeStudentId) return <LinkChildForm />;
  return null;
}
