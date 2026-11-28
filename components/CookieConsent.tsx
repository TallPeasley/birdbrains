'use client';

import { useEffect, useState } from 'react';
import { captureArrival, getConsent, setConsent } from '@/lib/attribution';

/**
 * Records where this visit came from (lib/attribution.ts) and asks once whether Quark
 * may keep that in a cookie. Declining keeps nothing on the device. Sign-in and the
 * consent choice itself need no permission; only the attribution cookies do.
 */
export default function CookieConsent() {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    captureArrival();
    setAsk(getConsent() === null);
  }, []);

  if (!ask) return null;
  const choose = (c: 'granted' | 'denied') => {
    setConsent(c);
    setAsk(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5"
    >
      <p className="text-sm text-slate-700">
        May Quark keep a cookie that remembers which link or invite brought you here? It helps us see which schools,
        tutors and posts send people our way. It holds no name or email, and nothing is shared with advertisers.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose('granted')} className="btn btn-primary">
          Allow
        </button>
        <button type="button" onClick={() => choose('denied')} className="btn btn-secondary">
          No thanks
        </button>
      </div>
    </div>
  );
}
