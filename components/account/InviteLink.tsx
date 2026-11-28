'use client';

import { useState } from 'react';
import { Check, Copy, Gift } from 'lucide-react';

/** The account's invite link (quark.study/?ref=CODE). Sign-ups from it are credited to it. */
export default function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quark.study';
  const link = `${origin}/?ref=${encodeURIComponent(code)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="invite-heading">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-indigo-600" aria-hidden />
        <h2 id="invite-heading" className="text-lg font-semibold text-slate-900">
          Invite a friend
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">Share your link. When someone signs up from it, we know you sent them.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <span className="min-w-0 break-all font-mono text-sm text-slate-900">{link}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </section>
  );
}
