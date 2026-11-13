import EqaoForecast from '@/components/parent/EqaoForecast';
import FrictionAlerts from '@/components/parent/FrictionAlerts';
import MasteryChart from '@/components/parent/MasteryChart';
import PillarErrorChart from '@/components/parent/PillarErrorChart';
import { parentSummary } from '@/lib/mockData';

export const metadata = { title: 'Parent Dashboard · BirdBrains' };

export default function ParentPage() {
  const s = parentSummary;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Parent dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            How {s.studentName.split(' ')[0]} is doing in {s.course}
          </h1>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {s.studentName} · {s.course === 'MPM2D' ? 'Grade 10' : 'Grade 9'}
        </span>
      </header>

      <FrictionAlerts alerts={s.cognitiveFrictionAlerts} />
      <MasteryChart strands={s.strandMasteries} />
      <div className="grid gap-6 lg:grid-cols-2">
        <EqaoForecast summary={s} />
        <PillarErrorChart data={s.pillarErrorDistribution} />
      </div>
    </div>
  );
}
