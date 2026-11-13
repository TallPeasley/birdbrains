'use client';

import { Camera } from 'lucide-react';
import { useRole } from '@/lib/roleContext';

export default function CaptureFab() {
  const { openCapture } = useRole();
  return (
    <button
      onClick={openCapture}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-95"
    >
      <Camera className="h-5 w-5" aria-hidden />
      Upload Work
    </button>
  );
}
