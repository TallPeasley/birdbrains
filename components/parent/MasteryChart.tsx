'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StrandMastery } from '@/types/birdBrains';
import { buildTrajectoryRows } from '@/lib/projections';

const STRAND_COLORS = ['#4f46e5', '#0ea5e9', '#8b5cf6', '#14b8a6'];

export default function MasteryChart({ strands }: { strands: StrandMastery[] }) {
  const rows = buildTrajectoryRows(strands);
  const lastActual = strands
    .map((s) => s.historicalTrajectory.at(-1)?.weekLabel)
    .filter((w): w is string => !!w)
    .sort((a, b) => Number(b.replace(/\D+/g, '')) - Number(a.replace(/\D+/g, '')))[0];

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mastery over time</h2>
          <p className="text-sm text-slate-500">
            Weekly scores by strand, smoothed with an exponentially weighted moving average. Dashed lines project the
            next two weeks.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {strands.map((s, i) => {
          const pct = Math.round(s.currentEWMAMastery * 100);
          return (
            <div key={s.strandName} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STRAND_COLORS[i % STRAND_COLORS.length] }} />
                <span className="text-sm font-medium text-slate-700">{s.strandName}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct}%</p>
              <p className={`text-xs font-medium ${pct >= 85 ? 'text-emerald-700' : pct >= 70 ? 'text-slate-500' : 'text-rose-600'}`}>
                {pct >= 85 ? 'Strong mastery' : pct >= 70 ? 'Developing' : 'Needs support'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 24, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis domain={[50, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            {lastActual && (
              <ReferenceLine x={lastActual} stroke="#94a3b8" strokeDasharray="2 4" label={{ value: 'Today', position: 'top', fontSize: 11, fill: '#64748b' }} />
            )}
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value: number, name: string) => [`${value}`, name.replace('__proj', ' (projected)')]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              payload={strands.map((s, i) => ({ value: s.strandName, type: 'line', color: STRAND_COLORS[i % STRAND_COLORS.length] }))}
            />
            {strands.map((s, i) => (
              <Line
                key={s.strandName}
                type="monotone"
                dataKey={s.strandName}
                stroke={STRAND_COLORS[i % STRAND_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {strands.map((s, i) => (
              <Line
                key={`${s.strandName}-proj`}
                type="monotone"
                dataKey={`${s.strandName}__proj`}
                stroke={STRAND_COLORS[i % STRAND_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                legendType="none"
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
