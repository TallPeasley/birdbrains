import type { AeroBrandKey } from './brands';

/**
 * Brand stage, fixed at build time.
 *   NEXT_PUBLIC_BRAND_STAGE="axiom-internal"  previews the Axiom (boson-axiom.web.app) identity for the tutoring network.
 *   anything else (unset in production)        keeps its live name, Swift Skills (swiftskills.ca).
 */
export const BRAND_STAGE = process.env.NEXT_PUBLIC_BRAND_STAGE ?? '';

/** Link overrides for the ecosystem switcher, so local previews can point at each other. Unset in production. */
export const AERO_URLS: Partial<Record<AeroBrandKey, string>> = {
  boson: process.env.NEXT_PUBLIC_AERO_URL_BOSON || undefined,
  axiom: process.env.NEXT_PUBLIC_AERO_URL_AXIOM || undefined,
  birdbrains: process.env.NEXT_PUBLIC_AERO_URL_BIRDBRAINS || undefined,
  planck: process.env.NEXT_PUBLIC_AERO_URL_PLANCK || undefined,
};
