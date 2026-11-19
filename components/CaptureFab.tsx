'use client';

import { Camera } from 'lucide-react';
import { useRole } from '@/lib/roleContext';

export default function CaptureFab() {
  const { openCapture } = useRole();
  return (
    <button
      onClick={openCapture}
      className="btn btn-lg btn-primary fixed bottom-5 right-5 z-30 rounded-full pl-5 pr-6 shadow-[0_12px_28px_-8px_rgba(79,70,229,0.8)] sm:bottom-6 sm:right-6"
    >
      <Camera className="h-5 w-5" aria-hidden />
      Upload Work
    </button>
  );
}
