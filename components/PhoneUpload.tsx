'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Loader2, Monitor, Send, Trash2 } from 'lucide-react';
import { analyzeImage, type ImageQualityResult } from '@/lib/imageQuality';
import { ApiError, phoneApi } from '@/lib/api';
import { UPLOAD_ERRORS } from '@/lib/uploadErrors';
import { MathText } from '@/components/MathText';
import type { ApiPhoneUpload } from '@/types/birdBrains';

const MAX_FILE_BYTES = 12 * 1024 * 1024;

interface Shot {
  id: string;
  file: File;
  url: string;
  quality?: ImageQualityResult;
  error?: string;
}

type View = 'loading' | 'ready' | 'sending' | 'done' | 'retake' | 'ended' | 'bad';

/**
 * The page a phone opens from the QR code on a computer's upload screen. No sign-in: the link
 * carries a one-time secret after "#". Photos are checked here, sent, and read; the result
 * shows up on the computer.
 */
export default function PhoneUpload() {
  const [link, setLink] = useState<{ id: string; secret: string } | null>(null);
  const [info, setInfo] = useState<ApiPhoneUpload | null>(null);
  const [view, setView] = useState<View>('loading');
  const [message, setMessage] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('s') ?? '';
    const key = `bb-phone-${id}`;
    let secret = new URLSearchParams(window.location.hash.slice(1)).get('t') ?? '';
    try {
      // Keep the secret for a reload, but take it out of the address bar.
      if (secret) sessionStorage.setItem(key, secret);
      else secret = sessionStorage.getItem(key) ?? '';
    } catch {
      /* private mode: the link still works until the tab is closed */
    }
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!id || !secret) {
      setView('bad');
      setMessage('This link is missing its code. Scan the QR code on your computer again.');
      return;
    }
    setLink({ id, secret });
    phoneApi
      .get(id, secret)
      .then((s) => {
        setInfo(s);
        if (s.state === 'WAITING' || s.state === 'NEEDS_RETAKE') setView('ready');
        else {
          setView('ended');
          setMessage(
            s.state === 'DONE' || s.state === 'PROCESSING'
              ? 'Photos were already sent with this code. Look at your computer for the result.'
              : 'This code has run out. Make a new QR code on your computer.',
          );
        }
      })
      .catch((err) => {
        setView('bad');
        setMessage(
          err instanceof ApiError && err.status === 410
            ? 'This code was turned off because the upload window was closed. Make a new QR code on your computer.'
            : err instanceof ApiError && err.status === 404
              ? 'This code doesn’t work. Scan the QR code on your computer again.'
              : err instanceof Error
                ? err.message
                : 'Something went wrong.',
        );
      });
  }, []);

  const max = info?.maxFiles ?? 6;

  const add = (list: FileList | null) => {
    const incoming: Shot[] = Array.from(list ?? []).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file),
      error: !file.type.startsWith('image/')
        ? 'Not a photo.'
        : file.size > MAX_FILE_BYTES
          ? 'Over 12 MB. Take it again.'
          : undefined,
    }));
    setShots((prev) => [...prev, ...incoming].slice(0, max));
    incoming
      .filter((s) => !s.error)
      .forEach(async (s) => {
        try {
          const quality = await analyzeImage(s.file);
          setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, quality } : x)));
        } catch (err) {
          setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, error: (err as Error).message } : x)));
        }
      });
  };

  const remove = (id: string) =>
    setShots((prev) => {
      prev.filter((s) => s.id === id).forEach((s) => URL.revokeObjectURL(s.url));
      return prev.filter((s) => s.id !== id);
    });

  const checking = shots.some((s) => !s.quality && !s.error);
  const ready = shots.length > 0 && !checking && shots.every((s) => !s.error && s.quality?.passed);

  const sendAll = async () => {
    if (!link || !ready) return;
    setView('sending');
    setMessage('');
    const sharpness = Math.min(...shots.map((s) => s.quality!.sharpnessScore));
    try {
      const out = await phoneApi.send(link.id, link.secret, shots.map((s) => s.file), sharpness);
      if (out.state === 'DONE') {
        setView('done');
      } else if (out.state === 'NEEDS_RETAKE') {
        const code = out.failureCode && UPLOAD_ERRORS[out.failureCode] ? out.failureCode : 201;
        setShots([]);
        setView('retake');
        setMessage(`${UPLOAD_ERRORS[code].message} ${UPLOAD_ERRORS[code].action} (Code ${code})`);
      } else {
        setView('ended');
        const code = out.failureCode && UPLOAD_ERRORS[out.failureCode] ? out.failureCode : 900;
        setMessage(`${UPLOAD_ERRORS[code]?.message ?? 'That didn’t work.'} Make a new QR code on your computer to try again.`);
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const known = code && UPLOAD_ERRORS[code];
      if (err instanceof ApiError && (err.status === 410 || err.status === 409)) {
        setView('ended');
        setMessage(known ? `${known.message} ${known.action}` : 'This code has run out. Make a new one on your computer.');
        return;
      }
      // Size, blur and duplicate problems: the code is still good for another photo.
      setView('ready');
      setMessage(
        err instanceof ApiError && err.detail === 'FREE_LIMIT_REACHED'
          ? 'All Free uploads for this month are used.'
          : known
            ? `${known.message} ${known.action} (Code ${code})`
            : err instanceof Error
              ? err.message
              : 'Sending failed. Try again.',
      );
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header>
        <p className="eyebrow">Phone camera</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Take a photo of your work</h1>
        {info?.problem ? (
          <p className="mt-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-800">
            <MathText text={info.problem} />
          </p>
        ) : info?.kind === 'addPhotos' ? (
          <p className="mt-1 text-sm text-slate-600">
            Add another photo of the same page, or close-ups of single questions.
          </p>
        ) : null}
      </header>

      {view === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening…
        </p>
      )}

      {(view === 'bad' || view === 'ended') && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>{message}</p>
        </div>
      )}

      {view === 'done' && (
        <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-6 w-6" aria-hidden /> Sent and read
          </p>
          <p className="flex items-start gap-2 text-sm">
            <Monitor className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Your result is on your computer now. You can close this page.
          </p>
        </div>
      )}

      {view === 'sending' && (
        <div className="space-y-2 rounded-2xl bg-indigo-50 p-5 text-indigo-900 ring-1 ring-indigo-100" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Reading your work…
          </p>
          <p className="text-sm">This takes about a minute. Keep this page open; you can follow along on your computer.</p>
        </div>
      )}

      {(view === 'ready' || view === 'retake') && (
        <>
          {message && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <p>{message}</p>
            </div>
          )}
          <div className="grid gap-2">
            <button type="button" onClick={() => camera.current?.click()} disabled={shots.length >= max} className="btn btn-lg btn-primary w-full">
              <Camera className="h-5 w-5" aria-hidden /> {shots.length ? 'Take another photo' : 'Take photo'}
            </button>
            <button type="button" onClick={() => library.current?.click()} disabled={shots.length >= max} className="btn btn-secondary w-full">
              <ImagePlus className="h-4 w-4" aria-hidden /> Choose from your photos
            </button>
          </div>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={library}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-slate-500">
            Flat page, bright light, phone straight above it. Up to {max} photo{max === 1 ? '' : 's'}. Names and dates are
            blurred before anything is saved.
          </p>

          {shots.length > 0 && (
            <ul className="space-y-2">
              {shots.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" />
                  <p className="min-w-0 flex-1 text-sm">
                    {s.error ? (
                      <span className="text-rose-700">{s.error}</span>
                    ) : !s.quality ? (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking sharpness…
                      </span>
                    ) : s.quality.passed ? (
                      <span className="font-medium text-emerald-700">Clear enough to read</span>
                    ) : (
                      <span className="text-rose-700">
                        {s.quality.resolutionOk ? 'Too blurry.' : 'Too small.'} Remove it and take it again.
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label="Remove photo"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={() => void sendAll()} disabled={!ready} className="btn btn-lg btn-primary w-full">
            <Send className="h-5 w-5" aria-hidden /> Send to my computer
          </button>
        </>
      )}
    </div>
  );
}
