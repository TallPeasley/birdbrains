import type { AeroBrandKey } from './brands';

/**
 * Brand stage, fixed at build time.
 *   NEXT_PUBLIC_BRAND_STAGE="ascent-internal"  previews the Ascent (ascent.ca) identity for the tutoring network.
 *   anything else (unset in production)         keeps its live name, Swift Skills (swiftskills.ca).
 */
export const BRAND_STAGE = process.env.NEXT_PUBLIC_BRAND_STAGE ?? '';

/** Link overrides for the ecosystem switcher, so local previews can point at each other. Unset in production. */
export const AERO_URLS: Partial<Record<AeroBrandKey, string>> = {
  aero: process.env.NEXT_PUBLIC_AERO_URL_AERO || undefined,
  ascent: process.env.NEXT_PUBLIC_AERO_URL_ASCENT || undefined,
  birdbrains: process.env.NEXT_PUBLIC_AERO_URL_BIRDBRAINS || undefined,
  chirp: process.env.NEXT_PUBLIC_AERO_URL_CHIRP || undefined,
};
