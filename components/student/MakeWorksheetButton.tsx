'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { WS_3STAGE_V1 } from '@/types/birdBrains';

/** Worksheet statuses that can be made on the spot instead of overnight. */
export const MAKEABLE = new Set(['QUEUED', 'PENDING', 'FAILED']);

/** "Make my worksheet now": builds the practice worksheet on request (about 10 seconds; the practice set follows). */
export default function MakeWorksheetButton({
  gradingId,
  onMade,
  className = 'mt-3',
}: {
  gradingId: string;
  onMade: (ws: WS_3STAGE_V1) => void;
  /** Spacing around the button; the dashboard header passes '' to sit beside other buttons. */
  className?: string;
}) {
  const { getToken } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function make() {
    setBusy(true);
    setError('');
    try {
      onMade(await api.generateWorksheet(await getToken(), gradingId));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(
        status === 402
          ? 'Making worksheets is part of Pro.'
          : status === 502
            ? 'That worksheet did not pass our checks. Try again, or it will be made overnight.'
            : `The worksheet could not be made (${status || 'no connection'}). Try again, or it will be made overnight.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
      <button onClick={make} disabled={busy} className="btn btn-sm btn-primary">
        <Sparkles className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} aria-hidden />
        {busy ? 'Making your worksheet… (about 10 seconds)' : 'Make my worksheet now'}
      </button>
      {error && (
        <span className="text-rose-700" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
