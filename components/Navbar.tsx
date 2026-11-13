'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bird, GraduationCap, Users } from 'lucide-react';
import { useRole, type Role } from '@/lib/roleContext';

const OPTIONS: { value: Role; label: string; icon: typeof Users }[] = [
  { value: 'student', label: 'Student View', icon: GraduationCap },
  { value: 'parent', label: 'Parent View', icon: Users },
];

export default function Navbar() {
  const { role, setRole } = useRole();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <Bird className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg tracking-tight">BirdBrains</span>
        </Link>

        <div className="flex items-center gap-3">
          {pathname !== '/' && (
            <Link
              href={`/${role}`}
              className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 md:inline"
            >
              Dashboard
            </Link>
          )}
          <div
            role="radiogroup"
            aria-label="Switch view"
            className="relative flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200"
          >
            <span
              aria-hidden
              className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ${
                role === 'parent' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                role="radio"
                aria-checked={role === value}
                onClick={() => setRole(value)}
                className={`relative z-10 flex w-28 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:w-36 sm:text-sm ${
                  role === value ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
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
