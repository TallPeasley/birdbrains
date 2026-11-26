// Draws the Quark app icons (home screen, splash, favicon) into public/icons/.
// Run after changing the logo:  node tools/make_pwa_icons.js
// Uses the pre-installed Playwright Chromium to rasterize the SVG; the PNGs are committed.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const INDIGO = '#4f46e5'; // Tailwind indigo-600, same as the navbar logo tile
// Quark mark: three quarks joined in an orbit (same idea as the Aero kit logo), white on indigo.
const QUARK = `
  <circle cx="12" cy="12" r="9.5"/>
  <path d="M12 6.5L16.76 14.75H7.24Z" stroke-width="1.4"/>
  <circle cx="12" cy="6.5" r="1.9" fill="#fff" stroke="none"/>
  <circle cx="16.76" cy="14.75" r="1.9" fill="#fff" stroke="none"/>
  <circle cx="7.24" cy="14.75" r="1.9" fill="#fff" stroke="none"/>`;

// glyph: share of the canvas the mark fills; radius: corner rounding (0 = full bleed square).
function svg({ glyph, radius }) {
  const g = 24 / glyph; // viewBox size so the 24-unit glyph fills `glyph` of the canvas
  const off = (g - 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-off} ${-off} ${g} ${g}">
  <rect x="${-off}" y="${-off}" width="${g}" height="${g}" rx="${g * radius}" fill="${INDIGO}"/>
  <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${QUARK}</g>
</svg>`;
}

const ICONS = [
  // Android/desktop "any" icon: rounded tile like the navbar logo.
  { file: 'icon-192.png', size: 192, glyph: 0.62, radius: 0.22 },
  { file: 'icon-512.png', size: 512, glyph: 0.62, radius: 0.22 },
  // Maskable: full bleed, mark inside the 80% safe circle so any mask shape keeps it whole.
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
