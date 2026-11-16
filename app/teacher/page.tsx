import { Suspense } from 'react';
import TeacherClassroomDashboard from '@/components/teacher/TeacherClassroomDashboard';

export const metadata = {
  title: 'Teacher Classroom · BirdBrains',
};

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl p-6 text-sm text-slate-500">Loading teacher workspace…</div>}>
      <TeacherClassroomDashboard />
    </Suspense>
  );
}
