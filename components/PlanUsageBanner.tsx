'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import type { ApiUsage, PlanTier } from '@/types/birdBrains';
import { MathNumber, MathText } from '@/components/MathText';

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
      className={`aero-badge ${plan === 'pro' ? 'aero-badge--accent' : ''}`}
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
            <span className="text-slate-500">
              <MathNumber value={usage.usedThisMonth} /> uploaded
            </span>
          </p>
        </div>
        <Link
          href="/plans"
          className="text-xs font-semibold text-brand-3 hover:text-brand-3"
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
            <MathNumber value={exhausted ? 0 : remaining} /> of <MathNumber value={limit} /> uploads left this month
          </p>
        </div>
        <Link
          href="/plans"
          className="inline-flex items-center gap-1 rounded-sm bg-brand-3 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Upgrade to Pro
        </Link>
      </div>

      <div
        className="mt-2.5 h-2 overflow-hidden rounded-sm bg-slate-200"
        role="progressbar"
        aria-valuenow={usage.usedThisMonth}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="Uploads used this month"
      >
        <div
          className={`h-full rounded-sm ${exhausted ? 'bg-rose-500' : 'bg-brand'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!compact && (
        <p className="mt-2 text-xs text-slate-600">
          <MathText
            text={
              exhausted
                ? 'You have reached the Free monthly upload limit. Upgrade to Pro for unlimited uploads, mood insights, and nightly practice worksheets.'
                : 'Free includes 10 uploads per calendar month. Pro adds unlimited uploads, mood & friction insights, and nightly 3-stage practice worksheets.'
            }
          />
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
    <section className="card border-brand-line border-t-2 border-t-brand bg-brand-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="aero-badge aero-badge--accent">
              <Lock className="h-3 w-3" aria-hidden /> Pro feature
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            <MathText text={title} />
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <MathText text={description} />
          </p>
          {features && features.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {features.map((f) => (
                <li key={f}>
                  <MathText text={f} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/plans"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Upgrade to Pro
        </Link>
      </div>
    </section>
  );
}
