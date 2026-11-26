'use client';

import Link from 'next/link';
import { BarChart3, Repeat } from 'lucide-react';
import { mistakeName } from '@/lib/errorCodes';
import { PILLARS } from '@/lib/pillars';
import type { ProgressReport } from '@/types/birdBrains';
import { TopStrengths } from '@/components/student/Quirks';

function when(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/**
 * One student's progress at a glance, from GET /students/{id}/progress: uploads,
 * mastery per strand, and the mistakes that keep coming back (in plain words).
 * Used by the parent dashboard and the teacher's student view.
 */
export default function StudentProgressPanel({ report, showReportLink = true }: { report: ProgressReport; showReportLink?: boolean }) {
  const recurring = new Set(report.recurringCodes);
  const mistakes = [...report.errorCodes].sort((a, b) => b.count - a.count).slice(0, 5);
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`progress-${report.studentId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`progress-${report.studentId}`} className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BarChart3 className="h-5 w-5 text-indigo-600" aria-hidden /> Progress so far
        </h2>
        {showReportLink && (
          <Link href="/reports" className="text-sm font-semibold text-indigo-700 hover:underline">
            Full progress report
          </Link>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Uploads</dt>
          <dd className="text-xl font-bold text-slate-900">{report.uploads}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Average mastery</dt>
          <dd className="text-xl font-bold text-slate-900">{pct(report.averageMastery)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Last upload</dt>
          <dd className="text-xl font-bold text-slate-900">{when(report.lastUploadAt)}</dd>
        </div>
      </dl>

      {report.masteryByStrand.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800">Mastery by unit</h3>
          <ul className="mt-2 space-y-2">
            {report.masteryByStrand.map((s) => (
              <li key={s.strandName}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{s.strandName}</span>
                  <span className="font-semibold text-slate-800">{pct(s.mastery)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(s.mastery * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <TopStrengths rows={report.quirkCounts ?? []} name={report.studentName.split(' ')[0]} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-800">Most common antiquirks (mistakes)</h3>
        {mistakes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No antiquirks found yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {mistakes.map((m) => (
              <li key={m.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PILLARS[m.pillar]?.color }} aria-hidden />
                  <span className="text-slate-800">{mistakeName(m.code, m.name)}</span>
                  {recurring.has(m.code) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                      <Repeat className="h-3 w-3" aria-hidden /> keeps coming back
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {m.count} {m.count === 1 ? 'time' : 'times'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
