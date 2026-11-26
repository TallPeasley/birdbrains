'use client';

import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useRole } from '@/lib/roleContext';

/** Chrome/Edge/Samsung's install event (not in the TS DOM types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bb-install-dismissed';
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  // iPadOS 13+ reports itself as a Mac, so also check for touch.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

/**
 * Installable-app plumbing, mounted once in the root layout:
 * - registers the service worker (public/sw.js) on the live site,
 * - opens Upload Work when the app is launched from the "Upload work" home-screen shortcut,
 * - shows an "Install Quark" strip: a one-tap button on Android/Chrome, and the
 *   Share > Add to Home Screen steps on iPhone/iPad (Apple has no install button for sites).
 */
export default function PwaSetup() {
  const { openCapture } = useRole();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* the site still works without it */
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('capture') === '1') {
      openCapture();
      params.delete('capture');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }

    if (isStandalone() || recentlyDismissed()) return;

    if (isIos()) setShowIos(true);
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of Chrome's mini-bar
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setPromptEvent(null);
    setShowIos(false);
  };

  if (!promptEvent && !showIos) return null;

  return (
    <div className="border-b border-indigo-100 bg-indigo-50">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-slate-900">Get the Quark app</p>
          {promptEvent ? (
            <p className="text-slate-600">Opens full screen from your home screen, with the camera one tap away.</p>
          ) : (
            <p className="text-slate-600">
              Tap <Share className="inline h-4 w-4 align-[-3px] text-indigo-600" aria-label="Share" /> then{' '}
              <span className="whitespace-nowrap font-medium text-slate-800">
                <SquarePlus className="inline h-4 w-4 align-[-3px] text-indigo-600" aria-hidden /> Add to Home Screen
              </span>
              .
            </p>
          )}
        </div>
        {promptEvent && (
          <button
            onClick={async () => {
              await promptEvent.prompt();
              await promptEvent.userChoice.catch(() => null);
              setPromptEvent(null);
            }}
            className="shrink-0 btn btn-sm btn-primary"
          >
            <Download className="h-4 w-4" aria-hidden /> Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Not now"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
