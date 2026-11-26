import { Suspense } from 'react';
import PracticeSession from '@/components/practice/PracticeSession';

export const metadata = { title: 'Practice · Quark' };

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeSession />
    </Suspense>
  );
}
