'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bird, GraduationCap, UserCog, Users } from 'lucide-react';
import { useRole, type Role } from '@/lib/roleContext';
import { useSession } from '@/lib/session';
import { IS_LIVE } from '@/lib/api';

const OPTIONS: { value: Role; label: string; icon: typeof Users }[] = [
  { value: 'student', label: 'Student View', icon: GraduationCap },
  { value: 'parent', label: 'Parent View', icon: Users },
];

export default function Navbar() {
  const { role, setRole } = useRole();
  const pathname = usePathname();
  const { demo, setDemo, signedIn, profile } = useSession();
  const showAccount = demo || signedIn || Boolean(profile);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1.5 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-semibold text-slate-900 sm:gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white sm:h-9 sm:w-9">
            <Bird className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </span>
          <span className="text-sm tracking-tight sm:text-lg">BirdBrains</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {IS_LIVE && demo && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 sm:gap-2 sm:px-3 sm:text-xs">
              Demo
              <Link href="/" onClick={() => setDemo(false)} className="underline hover:text-amber-950">
                Exit
              </Link>
            </span>
          )}
          {pathname !== '/' && (
            <Link
              href={`/${role}`}
              className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 md:inline"
            >
              Dashboard
            </Link>
          )}
          {showAccount && (
            <Link
              href="/account"
              aria-current={pathname === '/account' ? 'page' : undefined}
              className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-sm ${
                pathname === '/account'
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <UserCog className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
              <span>Account</span>
            </Link>
          )}
          <div
            role="radiogroup"
            aria-label="Switch view"
            className="relative flex rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200 sm:p-1"
          >
            <span
              aria-hidden
              className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 sm:inset-y-1 sm:w-[calc(50%-4px)] ${
                role === 'parent' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                role="radio"
                aria-checked={role === value}
                onClick={() => setRole(value, pathname !== '/account')}
                className={`relative z-10 flex w-14 items-center justify-center gap-1 rounded-full px-1 py-1.5 text-[11px] font-semibold transition-colors sm:w-36 sm:gap-1.5 sm:px-2 sm:text-sm ${
                  role === value ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="hidden h-3.5 w-3.5 shrink-0 min-[400px]:inline sm:inline sm:h-4 sm:w-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
