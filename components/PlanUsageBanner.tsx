'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import type { ApiUsage, PlanTier } from '@/types/birdBrains';

export const DEMO_FREE_USAGE: ApiUsage = {
  studentId: 'stu_alexmercer99',
  plan: 'free',
  monthlyLimit: 10,
  usedThisMonth: 7,
  remaining: 3,
  resetsAt: '2026-12-01T00:00:00Z',
};

export const DEMO_PRO_USAGE: ApiUsage = {
  studentId: 'stu_alexmercer99',
  plan: 'pro',
  monthlyLimit: null,
  usedThisMonth: 7,
  remaining: null,
  resetsAt: '2026-12-01T00:00:00Z',
};

export function PlanBadge({ plan }: { plan: PlanTier }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
        plan === 'pro'
          ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {plan === 'pro' && <Sparkles className="h-3 w-3" aria-hidden />}
      {plan === 'pro' ? 'Pro' : 'Free'}
    </span>
  );
}

export function UploadsLeftMeter({
  usage,
  compact = false,
}: {
  usage: ApiUsage;
  compact?: boolean;
}) {
  const isPro = usage.plan === 'pro' || usage.monthlyLimit === null || usage.remaining === null;
  if (isPro) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <PlanBadge plan="pro" />
          <p className="text-sm font-medium text-slate-800">
            Unlimited uploads this month ·{' '}
            <span className="tabular-nums text-slate-500">{usage.usedThisMonth} uploaded</span>
          </p>
        </div>
        <Link
          href="/plans"
          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
        >
          Plan details
        </Link>
      </div>
    );
  }

  const limit = usage.monthlyLimit ?? 10;
  const remaining = usage.remaining ?? 0;
  const pct = Math.min(100, Math.round((usage.usedThisMonth / limit) * 100));
  const exhausted = remaining === 0;

  return (
    <div
      className={`card p-4 ${
        exhausted ? 'border-amber-300 bg-amber-50/60' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PlanBadge plan="free" />
          <p className="text-sm font-semibold text-slate-900">
            {exhausted
              ? `0 of ${limit} uploads left this month`
              : `${remaining} of ${limit} uploads left this month`}
          </p>
        </div>
        <Link
          href="/plans"
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Upgrade to Pro
        </Link>
      </div>

      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={usage.usedThisMonth}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="Uploads used this month"
      >
        <div
          className={`h-full rounded-full ${exhausted ? 'bg-rose-500' : 'bg-indigo-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!compact && (
        <p className="mt-2 text-xs text-slate-600">
          {exhausted
            ? 'You have reached the Free monthly upload limit. Upgrade to Pro for unlimited uploads, mood insights, and nightly practice worksheets.'
            : 'Free includes 10 uploads per calendar month. Pro adds unlimited uploads, mood & friction insights, and nightly 3-stage practice worksheets.'}
        </p>
      )}
    </div>
  );
}

export function LockedProCard({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features?: string[];
}) {
  return (
    <section className="card border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              <Lock className="h-3 w-3" aria-hidden /> Pro feature
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          {features && features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/plans"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Upgrade to Pro
        </Link>
      </div>
    </section>
  );
}
