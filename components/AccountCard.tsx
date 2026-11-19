'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, School } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useRole } from '@/lib/roleContext';
import type { GradeCourse } from '@/types/birdBrains';

const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';

/** Real sign-in / create-account card, shown on the home page when a backend is configured. */
export default function AccountCard() {
  const { ready, signedIn, profile, signIn, signInWithGoogle, signInWithMicrosoft, signUp, createProfile, signOut } = useSession();
  const { setRole } = useRole();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setLocalRole] = useState<'student' | 'parent' | 'teacher'>('student');
  const [course, setCourse] = useState<GradeCourse>('MPM2D');
  const [lmsMenu, setLmsMenu] = useState<'brightspace' | 'canvas' | null>(null);
  const [lmsUrl, setLmsUrl] = useState('');
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

  const go = (r: 'student' | 'parent' | 'teacher') => {
    if (r === 'teacher') {
      router.push('/teacher');
      return;
    }
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
    const roleLabel = profile.role === 'student' ? 'Student' : profile.role === 'teacher' ? 'Teacher' : 'Parent';
    return (
      <div className="card p-6">
        <p className="eyebrow">{roleLabel}</p>
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
          className="mt-4 w-full btn btn-primary"
        >
          {profile.role === 'teacher' ? 'Open teacher hub' : 'Open my dashboard'} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <button onClick={() => run(signOut)} className="btn btn-secondary mt-2 w-full">
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
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="I am a">
              {(['student', 'parent', 'teacher'] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setLocalRole(r)}
                  className={`rounded-xl border py-2 text-xs font-semibold sm:text-sm ${
                    role === r ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'
                  }`}>
                  {r === 'student' ? 'Student' : r === 'parent' ? 'Parent' : 'Teacher'}
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
          className="w-full btn btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {needsProfile ? 'Finish' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {!needsProfile && (
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-500">Or continue with your school account</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(signInWithGoogle)}
              className="btn btn-sm btn-secondary"
            >
              Google
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(signInWithMicrosoft)}
              className="btn btn-sm btn-secondary"
            >
              Microsoft
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['brightspace', 'canvas'] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => {
                  setLmsMenu(lmsMenu === p ? null : p);
                  setError('');
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold ${
                  lmsMenu === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <School className="h-3.5 w-3.5" aria-hidden />
                {p === 'brightspace' ? 'Brightspace' : 'Canvas'}
              </button>
            ))}
          </div>
          {lmsMenu && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <input
                type="url"
                placeholder={lmsMenu === 'brightspace' ? 'https://school.brightspace.com' : 'https://school.instructure.com'}
                value={lmsUrl}
                onChange={(e) => setLmsUrl(e.target.value)}
                className={input}
              />
              <button
                type="button"
                disabled={busy || !lmsUrl.trim()}
                onClick={() =>
                  void run(async () => {
                    const { url } = await api.lmsSsoConnect(lmsMenu, lmsUrl.trim());
                    window.location.assign(url);
                  })
                }
                className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Continue to {lmsMenu === 'brightspace' ? 'Brightspace' : 'Canvas'}
              </button>
            </div>
          )}
        </div>
      )}
      {needsProfile ? (
        <button onClick={() => run(signOut)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-800">
          Use a different account
        </button>
      ) : (
        <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
          className="btn-link mt-3 text-sm">
          {mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
        </button>
      )}
    </div>
  );
}
