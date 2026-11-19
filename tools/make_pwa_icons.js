// Draws the BirdBrains app icons (home screen, splash, favicon) into public/icons/.
// Run after changing the logo:  node tools/make_pwa_icons.js
// Uses the pre-installed Playwright Chromium to rasterize the SVG; the PNGs are committed.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const INDIGO = '#4f46e5'; // Tailwind indigo-600, same as the navbar logo tile
// Lucide "bird" icon (ISC licence), the same glyph the navbar uses.
const BIRD = `
  <path d="M16 7h.01"/>
  <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/>
  <path d="m20 7 2 .5-2 .5"/>
  <path d="M10 18v3"/>
  <path d="M14 17.75V21"/>
  <path d="M7 18a6 6 0 0 0 3.84-10.61"/>`;

// glyph: share of the canvas the bird fills; radius: corner rounding (0 = full bleed square).
function svg({ glyph, radius }) {
  const g = 24 / glyph; // viewBox size so the 24-unit glyph fills `glyph` of the canvas
  const off = (g - 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-off} ${-off} ${g} ${g}">
  <rect x="${-off}" y="${-off}" width="${g}" height="${g}" rx="${g * radius}" fill="${INDIGO}"/>
  <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BIRD}</g>
</svg>`;
}

const ICONS = [
  // Android/desktop "any" icon: rounded tile like the navbar logo.
  { file: 'icon-192.png', size: 192, glyph: 0.62, radius: 0.22 },
  { file: 'icon-512.png', size: 512, glyph: 0.62, radius: 0.22 },
  // Maskable: full bleed, bird inside the 80% safe circle so any mask shape keeps it whole.
  { file: 'icon-maskable-512.png', size: 512, glyph: 0.5, radius: 0 },
  { file: 'icon-maskable-192.png', size: 192, glyph: 0.5, radius: 0 },
  // iPhone home screen: full bleed square, iOS rounds the corners itself.
  { file: 'apple-touch-icon.png', size: 180, glyph: 0.6, radius: 0 },
  { file: 'favicon-32.png', size: 32, glyph: 0.72, radius: 0.22 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg({ glyph: 0.62, radius: 0.22 }));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
        <div style="width:${icon.size}px;height:${icon.size}px">${svg(icon).replace('<svg ', `<svg width="${icon.size}" height="${icon.size}" `)}</div>
      </body></html>`,
    );
    await page.screenshot({ path: path.join(OUT, icon.file), omitBackground: true });
    console.log('wrote', icon.file);
  }
  await browser.close();
})();
