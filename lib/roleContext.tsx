'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { UploadMode } from '@/lib/uploadModes';

export type Role = 'student' | 'parent';

/** Opening the upload window from a worksheet problem or a Google Classroom assignment:
 *  the upload remembers which one. */
export interface CaptureContext {
  worksheetGradingId?: string;
  /** A student's own Google Classroom assignment (beta). */
  classroomCourseId?: string;
  classroomWorkId?: string;
  /** Shown in the upload window and on the phone, e.g. "Section C: Find the distance…". */
  problem: string;
}

interface RoleContextValue {
  role: Role;
  setRole: (role: Role, navigate?: boolean) => void;
  isCaptureOpen: boolean;
  /** What the open upload window is for, when it was opened from a worksheet problem. */
  captureContext: CaptureContext | null;
  openCapture: (context?: CaptureContext) => void;
  /** Which kind of upload the window opens on (photo, slides or textbook). */
  captureMode: UploadMode;
  /** Open the upload window on a given mode (the student portal's action cards). */
  openCaptureMode: (mode: UploadMode) => void;
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
  const [captureContext, setCaptureContext] = useState<CaptureContext | null>(null);
  const [captureMode, setCaptureMode] = useState<UploadMode>('WORKSHEET_PHOTO');

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
      captureContext,
      openCapture: (context?: CaptureContext) => {
        // Also used straight as an onClick handler, so ignore anything that isn't a context.
        setCaptureContext(context && typeof context === 'object' && 'problem' in context ? context : null);
        setCaptureMode('WORKSHEET_PHOTO');
        setCaptureOpen(true);
      },
      captureMode,
      openCaptureMode: (mode: UploadMode) => {
        setCaptureContext(null);
        setCaptureMode(mode);
        setCaptureOpen(true);
      },
      closeCapture: () => setCaptureOpen(false),
    }),
    [role, setRole, isCaptureOpen, captureContext, captureMode],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
