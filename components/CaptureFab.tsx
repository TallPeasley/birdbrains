'use client';

import { Camera } from 'lucide-react';
import { useRole } from '@/lib/roleContext';

export default function CaptureFab() {
  const { openCapture } = useRole();
  return (
    <button
      onClick={openCapture}
      className="no-print fixed bottom-6 right-6 z-30 flex shadow-overlay items-center gap-2 rounded-sm bg-brand-3 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-deep active:scale-95"
    >
      <Camera className="h-5 w-5" aria-hidden />
      Upload Work
    </button>
  );
}
