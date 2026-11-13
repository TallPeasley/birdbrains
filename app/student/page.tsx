import AffectCard from '@/components/student/AffectCard';
import PillarCards from '@/components/student/PillarCards';
import StepDiagnostics from '@/components/student/StepDiagnostics';
import WorksheetViewer from '@/components/student/WorksheetViewer';
import { demoPersonas, gradingOutput, worksheet } from '@/lib/mockData';

export const metadata = { title: 'Student Dashboard · BirdBrains' };

export default function StudentPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Student dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Hi {demoPersonas.student.name.split(' ')[0]}, here&apos;s your latest diagnostic
        </h1>
      </header>
      <AffectCard grading={gradingOutput} />
      <PillarCards pillars={gradingOutput.pillarBreakdowns} />
      <StepDiagnostics grading={gradingOutput} />
      <WorksheetViewer worksheet={worksheet} />
    </div>
  );
}
