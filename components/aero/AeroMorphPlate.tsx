'use client';

import { useState } from 'react';
import AeroLogo from '@/components/aero/AeroLogo';
import { aeroBrand, type AeroBrandKey } from '@/lib/aero/brands';
import { BRAND_STAGE } from '@/lib/aero/stage';

/**
 * Interactive 2D Origami <-> 3D Isometric extrusion plate.
 * Defaults to 3D Isometric; hover or click smoothly morphs to the 2D Origami crease pattern and back.
 */
export default function AeroMorphPlate({
  brand,
  title,
  grid = true,
}: {
  brand: AeroBrandKey;
  title?: string;
  grid?: boolean;
}) {
  const [flat, setFlat] = useState(false);
  const b = aeroBrand(brand, BRAND_STAGE);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flat}
      aria-label={`${b.name} mark (${flat ? '2D Origami' : '3D Isometric'}). Click to toggle projection.`}
      title="Hover or click to morph 2D Origami ⇄ 3D Isometric"
      data-morph-default="3d"
      onClick={() => setFlat((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlat((v) => !v);
        }
      }}
      className={`aero-morph h-full w-full${flat ? ' aero-morph--flat' : ''}`}
    >
      <div className="aero-morph__stage">
        {grid && (
          <svg className="aero-morph__grid" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="44" height="44" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="2 2" />
            <circle cx="24" cy="24" r="20" stroke="#94A3B8" strokeWidth="0.6" />
            <line x1="0" y1="24" x2="48" y2="24" stroke="#94A3B8" strokeWidth="0.5" />
            <line x1="24" y1="0" x2="24" y2="48" stroke="#94A3B8" strokeWidth="0.5" />
            <line x1="2" y1="36" x2="46" y2="12" stroke="#38BDF8" strokeWidth="0.55" strokeDasharray="2 2" />
            <line x1="2" y1="12" x2="46" y2="36" stroke="#38BDF8" strokeWidth="0.55" strokeDasharray="2 2" />
          </svg>
        )}
        <div className="aero-morph__shadow" aria-hidden="true" />
        <div className="aero-morph__flat">
          <svg className="aero-morph__crease" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <line x1="24" y1="6" x2="24" y2="42" stroke={b.primary} strokeWidth="0.9" strokeDasharray="1.5 1.5" />
            <line x1="6" y1="24" x2="42" y2="24" stroke={b.primary} strokeWidth="0.9" strokeDasharray="1.5 1.5" />
            <line x1="12" y1="12" x2="36" y2="36" stroke={b.primary} strokeWidth="0.9" strokeDasharray="1.5 1.5" />
          </svg>
          <AeroLogo brand={brand} variant="origami" title={title} />
        </div>
        <div className="aero-morph__3d">
          <AeroLogo brand={brand} variant="isometric" />
        </div>
      </div>
    </div>
  );
}
