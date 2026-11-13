'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type Role = 'student' | 'parent';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role, navigate?: boolean) => void;
  isCaptureOpen: boolean;
  openCapture: () => void;
  closeCapture: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [roleState, setRoleState] = useState<Role>(
    pathname.startsWith('/parent') ? 'parent' : 'student',
  );
  const [isCaptureOpen, setCaptureOpen] = useState(false);

  // Keep the toggle honest when someone lands directly on a dashboard URL.
  const role: Role = pathname.startsWith('/parent')
    ? 'parent'
    : pathname.startsWith('/student')
      ? 'student'
      : roleState;

  const setRole = useCallback(
    (next: Role, navigate = true) => {
      setRoleState(next);
      // Client-side route change: no full page reload.
      if (navigate && pathname !== '/') router.push(`/${next}`);
    },
    [pathname, router],
  );

  const value = useMemo(
    () => ({
      role,
      setRole,
      isCaptureOpen,
      openCapture: () => setCaptureOpen(true),
      closeCapture: () => setCaptureOpen(false),
    }),
    [role, setRole, isCaptureOpen],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
