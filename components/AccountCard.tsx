'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/session';
import { useRole } from '@/lib/roleContext';
import type { GradeCourse } from '@/types/birdBrains';

const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';

/** Real sign-in / create-account card, shown on the home page when a backend is configured. */
export default function AccountCard() {
  const { ready, signedIn, profile, signIn, signUp, createProfile, signOut } = useSession();
  const { setRole } = useRole();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setLocalRole] = useState<'student' | 'parent'>('student');
  const [course, setCourse] = useState<GradeCourse>('MPM2D');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Signed in with Firebase but no BirdBrains profile yet (e.g. sign-up was interrupted).
  const needsProfile = signedIn && !profile;
  const showProfileFields = mode === 'signup' || needsProfile;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const go = (r: 'student' | 'parent') => {
    setRole(r, false);
    router.push(`/${r}`);
  };

  if (!ready) {
    return (
      <div className="card flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking sign-in…
      </div>
    );
  }

  if (profile) {
    return (
      <div className="card p-6">
        <p className="eyebrow">{profile.role === 'student' ? 'Student' : 'Parent'}</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Welcome back, {profile.name.split(' ')[0]}</h2>
        {profile.linkCode && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
            Parent link code: <span className="font-mono font-semibold text-slate-900">{profile.linkCode}</span>
            <span className="block text-xs text-slate-500">
              A parent enters this on their dashboard to follow your progress.
            </span>
          </p>
        )}
        <button
          onClick={() => go(profile.role)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Open my dashboard <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <button onClick={() => run(signOut)} className="mt-2 w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const details = { role, name: name.trim(), course: role === 'student' ? course : undefined };
    void run(async () => {
      if (needsProfile) await createProfile(details);
      else if (mode === 'signup') await signUp(email.trim(), password, details);
      else await signIn(email.trim(), password);
    });
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {needsProfile ? 'Finish setting up' : mode === 'signup' ? 'Create an account' : 'Sign in'}
      </h2>
      <p className="text-sm text-slate-500">
        {needsProfile ? 'Tell us who you are to finish.' : 'Students upload work. Parents follow along.'}
      </p>
      <form className="mt-4 space-y-2" onSubmit={submit}>
        {!needsProfile && (
          <>
            <input type="email" required placeholder="Email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={input} />
            <input type="password" required minLength={6} placeholder="Password" value={password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)} className={input} />
          </>
        )}
        {showProfileFields && (
          <>
            <input required maxLength={80} placeholder="Your name" autoComplete="name" value={name}
              onChange={(e) => setName(e.target.value)} className={input} />
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="I am a">
              {(['student', 'parent'] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setLocalRole(r)}
                  className={`rounded-xl border py-2 text-sm font-semibold ${
                    role === r ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'
                  }`}>
                  {r === 'student' ? 'I’m a student' : 'I’m a parent'}
                </button>
              ))}
            </div>
            {role === 'student' && (
              <select value={course} onChange={(e) => setCourse(e.target.value as GradeCourse)} className={input}
                aria-label="Course">
                <option value="MTH1W">Grade 9 · MTH1W</option>
                <option value="MPM2D">Grade 10 · MPM2D</option>
              </select>
            )}
          </>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {needsProfile ? 'Finish' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {needsProfile ? (
        <button onClick={() => run(signOut)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-800">
          Use a different account
        </button>
      ) : (
        <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
          className="mt-3 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          {mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
        </button>
      )}
    </div>
  );
}
