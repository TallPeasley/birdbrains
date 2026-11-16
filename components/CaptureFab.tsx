'use client';

import { Camera } from 'lucide-react';
import { useRole } from '@/lib/roleContext';

export default function CaptureFab() {
  const { openCapture } = useRole();
  return (
    <button
      type="button"
      onClick={openCapture}
      aria-label="Upload math work photo"
      className="fixed bottom-4 right-4 z-30 flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-95 sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5"
    >
      <Camera className="h-5 w-5" aria-hidden />
      Upload Work
    </button>
  );
}
