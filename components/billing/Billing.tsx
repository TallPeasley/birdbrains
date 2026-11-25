'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { BillingPrice } from '@/types/birdBrains';

/** "$12.99 CAD / month", or null when the price is unknown. */
export function formatPrice(p: BillingPrice | null): string | null {
  if (!p?.configured || p.amount == null || !p.currency) return null;
  const money = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: p.currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
  }).format(p.amount / 100);
  return `${money} ${p.currency.toUpperCase()}${p.interval ? ` / ${p.interval}` : ''}`;
}

/** The Pro price from Stripe. null while loading or when the API can't be reached. */
export function useBillingPrice(): BillingPrice | null {
  const { live } = useSession();
  const [price, setPrice] = useState<BillingPrice | null>(null);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .billingPrice()
      .then((p) => !cancelled && setPrice(p))
      .catch(() => !cancelled && setPrice(null));
    return () => {
      cancelled = true;
    };
  }, [live]);
  return price;
}

const CHECKOUT_ERRORS: Record<string, string> = {
  ALREADY_PRO: 'This account is already on Pro.',
  COVERED_BY_PARENT: 'A parent account linked to you already has Pro, so you are covered.',
  BILLING_NOT_CONFIGURED: 'Online upgrades are not open yet.',
};

/** Sends the browser to Stripe Checkout for Pro. */
export function UpgradeButton({ label = 'Upgrade to Pro' }: { label?: string }) {
  const { getToken } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const { url } = await api.startCheckout(await getToken());
            window.location.assign(url);
          } catch (e) {
            const detail = e instanceof ApiError ? e.message : '';
            setError(CHECKOUT_ERRORS[detail] ?? (detail || 'Checkout could not be started. Please try again.'));
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        {busy ? 'Opening secure checkout…' : label}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">Payment is handled by Stripe. Cancel any time from your account page.</p>
    </div>
  );
}

/** Opens Stripe's customer portal: change card, see invoices, cancel. */
export function ManageBillingButton() {
  const { getToken } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const { url } = await api.billingPortal(await getToken());
            window.location.assign(url);
          } catch {
            setError('The billing page could not be opened. Please try again.');
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
        Manage billing
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Back from Stripe Checkout (?upgrade=success|cancelled). The webhook sets the plan a
 * few seconds after payment, so on success the profile is re-read until it says Pro.
 */
export function UpgradeReturnNotice() {
  const { live, profile, refreshProfile } = useSession();
  const [status, setStatus] = useState<'success' | 'cancelled' | null>(null);
  const [waiting, setWaiting] = useState(false);
  const refresh = useRef(refreshProfile);
  refresh.current = refreshProfile;

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('upgrade');
    if (value === 'success' || value === 'cancelled') setStatus(value);
  }, []);

  const isPro = profile?.plan === 'pro';
  useEffect(() => {
    if (!live || status !== 'success' || isPro) {
      setWaiting(false);
      return;
    }
    setWaiting(true);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      refresh.current().catch(() => undefined);
      if (tries >= 10) {
        window.clearInterval(timer);
        setWaiting(false);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [live, status, isPro]);

  if (!status) return null;
  if (status === 'cancelled') {
    return (
      <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        Checkout was cancelled. You were not charged.
      </p>
    );
  }
  return (
    <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
      {isPro
        ? 'Thanks! Pro is now active on your account.'
        : waiting
          ? 'Payment received. Turning on Pro…'
          : 'Payment received. Pro can take a minute to appear; refresh this page if it still says Free.'}
    </p>
  );
}
