import type { Config } from 'tailwindcss';

// Aero design system (Option B: Swiss Architectural Grid + 30° isometric).
// The tokens live in app/aero.css, which aero-kit/sync.mjs generates. This file only maps them onto Tailwind utilities.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    // Sharp or subtle corners only: 2px, 3px, 4px. `rounded-full` is kept for true circles (spinners, the score ring).
    borderRadius: { none: '0', sm: '2px', DEFAULT: '3px', md: '3px', lg: '4px', full: '9999px' },
    // No drop shadows on the page. `shadow-overlay` is the one soft shadow, for layers that float above it (menus, the upload dialog).
    boxShadow: { none: 'none', overlay: 'var(--aero-overlay-shadow)' },
    extend: {
      fontFamily: {
        sans: ['var(--aero-font-body)'], // Tier 2: Inter (UI and body copy)
        display: ['var(--aero-font-display)'], // Tier 1: Plus Jakarta Sans (display and brand headers)
        mono: ['var(--aero-font-mono)'], // Tier 3: JetBrains Mono (telemetry, codes, pillar badges)
        serif: ['var(--aero-font-serif)'], // Instrument Serif (editorial accent)
      },
      letterSpacing: { display: '-0.03em' },
      colors: {
        canvas: 'var(--aero-canvas)', // #FAFAFA alabaster
        line: { DEFAULT: 'var(--aero-line)', strong: 'var(--aero-line-strong)' }, // #E2E8F0 structural border
        // Pillar accents. For BirdBrains: brand #6366F1, brand-2 #A855F7, brand-3 #3730A3.
        // brand = lines, indicators, large display text. brand-3 = small text and solid fills behind white text.
        brand: {
          DEFAULT: 'rgb(var(--aero-primary-rgb) / <alpha-value>)',
          2: 'rgb(var(--aero-secondary-rgb) / <alpha-value>)',
          3: 'rgb(var(--aero-tertiary-rgb) / <alpha-value>)',
          deep: 'var(--aero-accent-deep)',
          soft: 'var(--aero-accent-soft)',
          tint: 'var(--aero-accent-tint)',
          line: 'var(--aero-accent-line)',
        },
        slate: { 50: '#FAFAFA' },
      },
    },
  },
  plugins: [],
};
export default config;
