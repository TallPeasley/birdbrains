import { createElement } from 'react';
import { aeroLogo, type AeroBrandKey, type AeroLogoVariant } from '@/lib/aero/brands';
import { BRAND_STAGE } from '@/lib/aero/stage';

export interface AeroLogoProps {
  brand: AeroBrandKey;
  /**
   * kinetic: Series A, the 2.6px monoline mark (kept in the kit, no longer used).
   * isometric: Series B, the 30° axonometric sculpture. Used everywhere (default).
   */
  variant?: AeroLogoVariant;
  /** Width and height in px. Leave unset to let the surrounding CSS size it (28px by default). */
  size?: number;
  /** Accessible name. Leave unset when the brand name is printed next to the logo; it is then decorative. */
  title?: string;
  className?: string;
}

/**
 * The locked Aero master logos (48x48 viewBox). The vector coordinates come from aero-kit/brands.json
 * through lib/aero/brands.ts and are never redrawn here.
 */
export default function AeroLogo({ brand, variant = 'isometric', size, title, className }: AeroLogoProps) {
  const art = aeroLogo(brand, variant, BRAND_STAGE);
  return (
    <svg
      className={`aero-logo${className ? ` ${className}` : ''}`}
      viewBox={art.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      focusable="false"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {art.nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
