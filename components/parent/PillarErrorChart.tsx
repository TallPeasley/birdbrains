'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ParentProjectionSummary } from '@/types/birdBrains';
import { PILLARS } from '@/lib/pillars';

export default function PillarErrorChart({ data }: { data: ParentProjectionSummary['pillarErrorDistribution'] }) {
  const sorted = [...data].sort((a, b) => b.percentageOfTotalErrors - a.percentageOfTotalErrors);
  const top = sorted[0];

  return (
    <section className="card min-w-0 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Where errors come from</h2>
      <p className="text-sm text-slate-500">Share of all errors by pillar.</p>

      <div className="mt-4 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="percentageOfTotalErrors"
                nameKey="pillar"
                innerRadius="62%"
                outerRadius="100%"
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {sorted.map((d) => (
                  <Cell key={d.pillar} fill={PILLARS[d.pillar].color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n: string) => [`${v}%`, PILLARS[n as keyof typeof PILLARS]?.short ?? n]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {top && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{top.percentageOfTotalErrors}%</span>
              <span className="text-[11px] text-slate-500">{PILLARS[top.pillar].short}</span>
            </div>
          )}
        </div>

        <ul className="min-w-0 space-y-3">
          {sorted.map((d) => (
            <li key={d.pillar} className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PILLARS[d.pillar].color }} />
                  <span className="truncate">{PILLARS[d.pillar].label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{d.percentageOfTotalErrors}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${d.percentageOfTotalErrors}%`, backgroundColor: PILLARS[d.pillar].color }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {top && (
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
          Most mistakes are <strong className="text-slate-900">{PILLARS[top.pillar].short.toLowerCase()}</strong>
          {top.pillar === 'PRC' || top.pillar === 'FAC'
            ? ': slips in carrying out steps, not gaps in understanding. Slowing down and checking each line helps most.'
            : '.'}
        </p>
      )}
    </section>
  );
}
