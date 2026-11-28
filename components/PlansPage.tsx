'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/roleContext';
import { useSession } from '@/lib/session';
import {
  DEMO_FREE_USAGE,
  DEMO_PRO_USAGE,
  PlanBadge,
  UploadsLeftMeter,
} from '@/components/PlanUsageBanner';
import type { ApiUsage, PlanTier } from '@/types/birdBrains';
import { formatPrice, ManageBillingButton, UpgradeButton, UpgradeReturnNotice, useBillingPrice } from '@/components/billing/Billing';

const COMPARISON_ROWS: {
  feature: string;
  detail: string;
  free: string | boolean;
  pro: string | boolean;
}[] = [
  {
    feature: 'Monthly work uploads',
    detail: 'Handwritten pages checked per student each calendar month.',
    free: '10 per month',
    pro: 'Unlimited',
  },
  {
    feature: 'Step-by-step check that finds the exact line with the mistake',
    detail: 'Checks each line on its own so an early slip does not cost marks twice.',
    free: true,
    pro: true,
  },
  {
    feature: '6-pillar breakdown & 48 error codes',
    detail: 'Conceptual, Procedural, Calculation, and Communication scores with feedback.',
    free: true,
    pro: true,
  },
  {
    feature: 'Mastery chart, achievement forecast & error distribution',
    detail: 'Strand trends over time and provincial level forecast on the parent view.',
    free: true,
    pro: true,
  },
  {
    feature: 'Mood & cognitive friction insights',
    detail: 'Detects frustration or rushing on tough problems and gives parents tips to try at home.',
    free: false,
    pro: true,
  },
  {
    feature: 'Adaptive scaffolding mode',
    detail: 'Adjusts practice between standard fade, speed bumps, and extra support when frustration is high.',
    free: false,
    pro: true,
  },
  {
    feature: 'Nightly 3-stage practice worksheets',
    detail: 'Overnight worksheet built from the exact mistake: Diagnostic Mirror, Faded Scaffolding, and Independent Transfer.',
    free: false,
    pro: true,
  },
];

export default function PlansPage() {
  const { role } = useRole();
  const { live, demo, profile, activeStudentId, getToken } = useSession();
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoTier, setDemoTier] = useState<PlanTier>('free');
  const [interestSubmitted, setInterestSubmitted] = useState(false);
  const [interestEmail, setInterestEmail] = useState('');
  const billingPrice = useBillingPrice();
  const proPrice = formatPrice(billingPrice);
  const canBuy = live && !!profile && !!billingPrice?.configured && !profile.tester;

  useEffect(() => {
    if (!live || !activeStudentId) {
      setUsage(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getToken()
      .then((t) => api.usage(t, activeStudentId))
      .then((u) => {
        if (!cancelled) setUsage(u);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken]);

  const effectiveUsage = live
    ? usage
    : demoTier === 'pro'
      ? DEMO_PRO_USAGE
      : DEMO_FREE_USAGE;
  const currentPlan: PlanTier = effectiveUsage?.plan ?? profile?.plan ?? demoTier;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Plans &amp; monthly usage</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Free vs. Pro
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Every account starts on Free with 6-pillar step diagnostics. Pro covers the student or every child linked to a Pro parent account.
          </p>
        </div>
        <Link
          href={`/${role}`}
          className="btn btn-secondary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </header>

      {live && <UpgradeReturnNotice />}

      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
          <span>
            <strong>Demo preview:</strong> switch between sample Free and Pro states to see how the usage meter respond.
          </span>
          <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-amber-200" role="radiogroup" aria-label="Preview plan">
            {(['free', 'pro'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={demoTier === tier}
                onClick={() => setDemoTier(tier)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                  demoTier === tier
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center gap-2 p-5 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading your plan and monthly upload count…
        </div>
      ) : (
        effectiveUsage && <UploadsLeftMeter usage={effectiveUsage} />
      )}

      {/* Plan cards */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="card flex flex-col justify-between p-5 sm:p-6" aria-labelledby="free-plan-heading">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 id="free-plan-heading" className="text-lg font-semibold text-slate-900">
                Free
              </h2>
              <PlanBadge plan="free" />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Core 6-pillar step diagnostics and mastery tracking for students and parents.
            </p>
            <p className="mt-4 text-2xl font-bold text-slate-900">
              10 uploads <span className="text-sm font-normal text-slate-500">/ student / month</span>
            </p>

            <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Step-by-step check that finds the exact line with the mistake, and no marks lost for later lines that follow from it</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>6-pillar scores, 48 error codes, and supportive feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Mastery chart, achievement forecast, and pillar error share</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <span className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700">
              {currentPlan === 'free' ? 'Current plan' : 'Included on every account'}
            </span>
          </div>
        </section>

        <section
          className="card flex flex-col justify-between border-indigo-300 bg-gradient-to-b from-indigo-50/50 via-white to-white p-5 ring-1 ring-indigo-200 sm:p-6"
          aria-labelledby="pro-plan-heading"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 id="pro-plan-heading" className="text-lg font-semibold text-slate-900">
                Pro
              </h2>
              <PlanBadge plan="pro" />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Unlimited uploads, mood &amp; friction insights, and overnight 3-stage practice worksheets. A Pro parent covers every linked child.
            </p>
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {proPrice ?? (
                <>
                  Unlimited uploads <span className="text-sm font-normal text-slate-500">each month</span>
                </>
              )}
            </p>

            <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <span>Everything in Free, with no monthly upload cap</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <span>Mood &amp; friction signals on student work and parent home-support alerts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <span>Adaptive scaffolding modes (speed bumps &amp; high-support de-escalation)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <span>Nightly 3-stage practice worksheet built from each flagged diagnostic</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 border-t border-indigo-100 pt-4">
            {currentPlan === 'pro' ? (
              <div className="space-y-3">
                <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <Check className="h-4 w-4" aria-hidden /> Active on your account
                </span>
                {live && profile?.hasBilling && <ManageBillingButton />}
              </div>
            ) : canBuy ? (
              <UpgradeButton label={proPrice ? `Upgrade to Pro · ${proPrice}` : 'Upgrade to Pro'} />
            ) : interestSubmitted ? (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
              >
                Pro checkout is coming soon. Thanks for letting us know you&apos;re interested!
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setInterestSubmitted(true);
                }}
                className="space-y-2"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={interestEmail}
                    onChange={(e) => setInterestEmail(e.target.value)}
                    placeholder="Email for Pro pilot access (optional)"
                    aria-label="Email for Pro pilot access"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="shrink-0 btn btn-primary"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Upgrade · Coming soon
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Online checkout is coming soon. Tell us if your family wants early Pro access.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Detailed comparison */}
      <section className="card overflow-hidden" aria-labelledby="compare-heading">
        <div className="border-b border-slate-200 p-4 sm:p-6">
          <h2 id="compare-heading" className="text-lg font-semibold text-slate-900">
            What each plan includes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Old diagnostics keep the features of the plan they were graded under.
          </p>
        </div>

        <ul className="divide-y divide-slate-200">
          {COMPARISON_ROWS.map((row) => (
            <li key={row.feature} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{row.feature}</p>
                <p className="mt-0.5 text-xs text-slate-500">{row.detail}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:contents">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 sm:w-28 sm:justify-center">
                  <span className="text-slate-400 sm:hidden">Free:</span>
                  {typeof row.free === 'string' ? (
                    <span>{row.free}</span>
                  ) : row.free ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-label="Included in Free" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-300" aria-label="Not in Free" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 sm:w-28 sm:justify-center">
                  <span className="text-indigo-400 sm:hidden">Pro:</span>
                  {typeof row.pro === 'string' ? (
                    <span>{row.pro}</span>
                  ) : row.pro ? (
                    <Check className="h-4 w-4 text-indigo-600" aria-label="Included in Pro" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-300" aria-label="Not in Pro" />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
