'use client';

import { Loader2 } from 'lucide-react';
import type { ClassroomBetaStatus } from '@/types/birdBrains';

/** Google Classroom is a "sign up to test" beta: Google lets an unverified app connect
 *  only for accounts we list as Test users, so each teacher is added by hand. */
export default function ClassroomBetaSignup({
  status,
  email,
  onEmail,
  busy,
  onJoin,
}: {
  status: ClassroomBetaStatus;
  email: string;
  onEmail: (v: string) => void;
  busy: boolean;
  onJoin: () => void;
}) {
  if (status === 'pending') {
    return (
      <p className="w-full rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
        You’re on the list to test Google Classroom. Once we add your Google account, the Connect button
        appears here.
      </p>
    );
  }
  if (status === 'declined') {
    return (
      <p className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        The Google Classroom test group is full right now. We’ll open it to everyone after Google approves
        Quark.
      </p>
    );
  }
  return (
    <form
      className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onJoin();
      }}
    >
      <p className="text-xs text-slate-600">
        Google Classroom is in testing. Sign up with the Google account you use for Classroom and we’ll add
        you to the test group.
      </p>
      <input
        type="email"
        required
        placeholder="you@school.ca"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        aria-label="Google account email you use for Classroom"
        className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button type="submit" disabled={busy || !email.trim()} className="inline-flex w-full items-center justify-center gap-1.5 btn btn-sm btn-primary">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        Sign up to test
      </button>
    </form>
  );
}
