'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, Users } from 'lucide-react';
import AeroGlobalHeader from '@/components/aero/AeroGlobalHeader';
import { useRole, type Role } from '@/lib/roleContext';
import { useSession } from '@/lib/session';
import { IS_LIVE } from '@/lib/api';

const OPTIONS: { value: Role; label: string; icon: typeof Users }[] = [
  { value: 'student', label: 'Student View', icon: GraduationCap },
  { value: 'parent', label: 'Parent View', icon: Users },
];

/** Monospace coordinate badge for each route, shown at the far right of the header. */
const COORDS: Record<string, string> = {
  '/': 'BB-00 / HOME',
  '/student': 'BB-01 / STUDENT',
  '/parent': 'BB-02 / PARENT',
  '/plans': 'BB-03 / PLANS',
  '/account': 'BB-04 / ACCOUNT',
  '/reports': 'BB-05 / REPORTS',
  '/teacher': 'BB-06 / TEACHER',
  '/how-it-works': 'BB-07 / DEMO',
};

/** BirdBrains' own links and controls, inside the shared Aero shell header. */
export default function Navbar() {
  const { role, setRole } = useRole();
  const pathname = usePathname();
  const { demo, signedIn, profile } = useSession();
  const showAccount = demo || signedIn || Boolean(profile);
  // The sample student/parent now live on /how-it-works. Dashboards are for signed-in people
  // (or local builds with no API, which show mock data).
  const hasDashboard = !IS_LIVE || Boolean(profile);
  const showDashboard = hasDashboard && pathname !== '/';

  return (
    <AeroGlobalHeader
      brand="birdbrains"
      home="/"
      stack
      coord={COORDS[pathname] ?? 'BB-00'}
      nav={
        <>
          {showDashboard && (
            <Link href={`/${role}`} aria-current={pathname === `/${role}` ? 'page' : undefined}>
              Dashboard
            </Link>
          )}
          <Link href="/how-it-works" aria-current={pathname === '/how-it-works' ? 'page' : undefined}>
            How it works
          </Link>
          <Link href="/plans" aria-current={pathname === '/plans' ? 'page' : undefined}>
            Plans
          </Link>
          <Link href="/reports" aria-current={pathname === '/reports' ? 'page' : undefined}>
            Reports
          </Link>
          {(demo || profile?.role === 'teacher') && (
            <Link href="/teacher" aria-current={pathname === '/teacher' ? 'page' : undefined}>
              Teacher
            </Link>
          )}
          {showAccount && (
            <Link href="/account" aria-current={pathname === '/account' ? 'page' : undefined}>
              Account
            </Link>
          )}
        </>
      }
    >
      {hasDashboard && (
        <div
          role="radiogroup"
          aria-label="Switch view"
          className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-canvas"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={role === value}
              onClick={() => setRole(value, pathname !== '/account')}
              className={`flex h-8 items-center justify-center gap-1.5 border-b-2 px-2.5 text-xs font-semibold transition-colors first:border-r first:border-r-line sm:px-3 sm:text-[13px] ${
                role === value
                  ? 'border-b-brand bg-white text-slate-900'
                  : 'border-b-transparent text-slate-500 hover:bg-white hover:text-slate-800'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${role === value ? 'text-brand' : ''}`} aria-hidden />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}
      {IS_LIVE && !profile && (
        <Link href="/#get-started" className="btn btn-sm btn-primary">
          Sign in
        </Link>
      )}
    </AeroGlobalHeader>
  );
}
