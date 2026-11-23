'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, GraduationCap, Loader2, School, Users } from 'lucide-react';
import { useSession } from '@/lib/session';
import type { PlanTier } from '@/types/birdBrains';

type ViewRole = 'student' | 'parent' | 'teacher';

const ROLES: { value: ViewRole; label: string; icon: typeof Users }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'parent', label: 'Parent', icon: Users },
  { value: 'teacher', label: 'Teacher', icon: School },
];
const PLANS: PlanTier[] = ['free', 'pro'];

/** Pages that belong to one role: switching view from one of these goes to the new role's dashboard. */
const ROLE_PAGES = ['/student', '/parent', '/teacher'];

/**
 * Testing accounts only: a strip under the header to switch view (student, parent,
 * teacher) and plan (Free, Pro) on the fly. All views show the tester's own uploads.
 * Nobody else sees it, and the API refuses the switch for anyone who is not a tester.
 */
export default function TesterBar() {
  const { profile, setTesterView } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!profile?.tester) return null;
  const plan: PlanTier = profile.plan ?? 'pro';

  const run = async (key: string, change: { role?: ViewRole; plan?: PlanTier }) => {
    setBusy(key);
    setError('');
    try {
      await setTesterView(change);
      if (change.role && (ROLE_PAGES.includes(pathname) || pathname === '/')) router.push(`/${change.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch.');
    } finally {
      setBusy(null);
    }
  };

  const seg = (active: boolean) =>
    `inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors ${
      active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-amber-300' : 'text-amber-900/80 hover:bg-white/60'
    }`;

  return (
    <div className="no-print border-b border-amber-200 bg-amber-50" role="region" aria-label="Testing account controls">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Testing account
        </span>
        <div role="radiogroup" aria-label="View as" className="flex items-center gap-1">
          <span className="mr-1 text-xs text-amber-900/80">View as</span>
          {ROLES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={profile.role === value}
              disabled={busy !== null}
              onClick={() => profile.role !== value && run(value, { role: value })}
              className={seg(profile.role === value)}
            >
              {busy === value ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Icon className="h-3 w-3" aria-hidden />}
              {label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Plan" className="flex items-center gap-1">
          <span className="mr-1 text-xs text-amber-900/80">Plan</span>
          {PLANS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={plan === p}
              disabled={busy !== null}
              onClick={() => plan !== p && run(p, { plan: p })}
              className={seg(plan === p)}
            >
              {busy === p && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {p === 'pro' ? 'Pro' : 'Free'}
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-amber-900/70 lg:inline">Every view shows your own uploads. Only testing accounts see this bar.</span>
        {error && (
          <span role="alert" className="text-xs font-semibold text-rose-700">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
