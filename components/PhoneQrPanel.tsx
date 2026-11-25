'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ApiPhoneUpload, CreatePhoneUpload } from '@/types/birdBrains';

const POLL_MS = 2000;

/**
 * "Use your phone camera": a QR code that opens /phone on a phone, where photos can be taken
 * and sent without signing in. The link is made by the signed-in computer, works for 15 minutes
 * and one upload, and is turned off when this panel goes away before photos were sent.
 * The panel watches the link and reports every change through onUpdate.
 */
export default function PhoneQrPanel({
  request,
  onUpdate,
  compact = false,
}: {
  request: CreatePhoneUpload;
  onUpdate?: (s: ApiPhoneUpload) => void;
  /** Smaller code and text, for inline spots such as "Add photos of this page". */
  compact?: boolean;
}) {
  const { getToken } = useSession();
  const [svg, setSvg] = useState('');
  const [session, setSession] = useState<ApiPhoneUpload | null>(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  const sessionId = useRef<string | null>(null);
  const latest = useRef<ApiPhoneUpload | null>(null);
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const key = JSON.stringify(request);

  // Make a link (again when the request changes or "New code" is pressed).
  useEffect(() => {
    let gone = false;
    const cancel = async (id: string) => {
      try {
        await api.cancelPhoneUpload(await getToken(), id);
      } catch {
        /* the link runs out by itself in 15 minutes */
      }
    };
    setSvg('');
    setError('');
    setSession(null);
    latest.current = null;
    (async () => {
      try {
        const link = await api.createPhoneUpload(await getToken(), JSON.parse(key) as CreatePhoneUpload);
        if (gone) {
          void cancel(link.sessionId);
          return;
        }
        sessionId.current = link.sessionId;
        // The secret goes after "#", so it is never sent to the web host or kept in its logs.
        const url = `${window.location.origin}/phone?s=${encodeURIComponent(link.sessionId)}#t=${encodeURIComponent(link.token)}`;
        setSvg(await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }));
      } catch (err) {
        if (!gone) setError(err instanceof ApiError ? err.detail : 'Could not make a phone code.');
      }
    })();
    return () => {
      gone = true;
      const id = sessionId.current;
      const state = latest.current?.state;
      sessionId.current = null;
      if (id && (!state || state === 'WAITING' || state === 'NEEDS_RETAKE')) void cancel(id);
    };
  }, [key, round, getToken]);

  // Watch the link.
  useEffect(() => {
    if (!svg) return;
    let stop = false;
    const tick = async () => {
      const id = sessionId.current;
      if (!id || stop) return;
      try {
        const s = await api.phoneUpload(await getToken(), id);
        if (stop) return;
        const prev = latest.current;
        latest.current = s;
        setSession(s);
        if (!prev || prev.state !== s.state || prev.submissionId !== s.submissionId) update.current?.(s);
      } catch {
        /* keep trying */
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [svg, getToken]);

  const renew = useCallback(() => setRound((n) => n + 1), []);
  const state = session?.state ?? 'WAITING';
  const ended = state === 'EXPIRED' || state === 'CANCELLED' || state === 'DONE' || state === 'FAILED';
  const size = compact ? 'h-32 w-32' : 'h-40 w-40';

  return (
    <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col items-center gap-2 text-center'}`}>
      <div className={`relative grid ${size} shrink-0 place-items-center rounded-xl bg-white p-1.5 ring-1 ring-slate-200`}>
        {svg ? (
          <div
            aria-label="QR code for taking the photo on your phone"
            role="img"
            className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${ended ? 'opacity-15' : ''}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : error ? null : (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        )}
        {(ended || error) && (
          <button type="button" onClick={renew} className="btn btn-sm btn-secondary absolute">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> New code
          </button>
        )}
      </div>
      <div className={compact ? 'min-w-0 text-left' : ''}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 [justify-content:inherit]">
          <Smartphone className="h-4 w-4 text-indigo-600" aria-hidden /> Use your phone camera
        </p>
        <p className="mt-0.5 text-xs text-slate-500" role="status">
          {error
            ? error
            : state === 'PROCESSING'
              ? 'Photos arrived from your phone. Reading them now…'
              : state === 'NEEDS_RETAKE'
                ? 'We couldn’t read that photo. Take another one on your phone.'
                : state === 'DONE'
                  ? 'Done. Your phone’s photos were read.'
                  : state === 'FAILED'
                    ? 'That didn’t work. Make a new code to try again.'
                    : ended
                      ? 'This code has run out. Make a new one.'
                      : 'Scan with your phone’s camera, take the photo there, and the result shows up here. Works for 15 minutes, no sign-in on the phone.'}
        </p>
      </div>
    </div>
  );
}
