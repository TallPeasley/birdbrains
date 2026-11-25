import StudentDashboard from '@/components/student/StudentDashboard';
import ClassroomPanel from '@/components/student/ClassroomPanel';

export const metadata = { title: 'Student Dashboard · BirdBrains' };

export default function StudentPage() {
  return (
    <div className="space-y-6">
      <ClassroomPanel />
      <StudentDashboard />
    </div>
  );
}
