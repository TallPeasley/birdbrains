import katex from 'katex';

/**
 * Fractions are typeset by KaTeX (the hand-built stacked spans misaligned signs, mixed numbers and
 * baselines). Everything else in MathText keeps its own renderer.
 */

const ATOM = String.raw`(?:\([^()]*\)|\d+(?:\.\d+)?[a-zA-Z]?|[a-zA-Z])`;
const FRACTION = new RegExp(String.raw`(${ATOM}(?:\^\{?[\w+-]+\}?)?)\s*/\s*(${ATOM})`, 'g');
const MIXED = /(^|[^\d.])(\d+)\s+(\d+)\s*\/\s*(\d+)(?![\d/])/g;

const unwrap = (s: string) => (/^\([^()]*\)$/.test(s) ? s.slice(1, -1) : s);

/** Does this line of maths contain a fraction KaTeX should draw? */
export function hasFraction(text: string): boolean {
  // Lines that are mostly words ("Half of 6/2 is 3") stay with the prose renderer.
  if (/\b(?!(?:sin|cos|tan|log|sqrt)\b)[a-zA-Z]{3,}\b/.test(text)) return false;
  if (/\\[dt]?frac\{/.test(text)) return true;
  // Dates (2024/10/24) and words with slashes ("and/or") are not fractions.
  return /(^|[^\d/])(\d+(?:\.\d+)?|[a-zA-Z]|\([^()]*\))\s*\/\s*(\d|[a-zA-Z]\b|\()/.test(text) && !/\d+\/\d+\/\d+/.test(text);
}

/** Plain-text school maths ("4 2/7 - 8 = y", "-30/7", "(x+1)/2", "x^2") to LaTeX. */
export function toLatex(text: string): string {
  let s = text.trim();
  if (/\\[a-zA-Z]+/.test(s)) return s; // already LaTeX
  s = s
    .replace(MIXED, (_, pre, whole, n, d) => `${pre}${whole}\\frac{${n}}{${d}}`)
    .replace(FRACTION, (_, n, d) => `\\frac{${unwrap(n)}}{${unwrap(d)}}`)
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\^(-?[\w.]+)/g, '^{$1}')
    .replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/\*|×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/>=|≥/g, '\\ge ')
    .replace(/<=|≤/g, '\\le ')
    .replace(/!=|≠/g, '\\ne ')
    .replace(/\+-|±/g, '\\pm ')
    .replace(/−/g, '-')
    .replace(/\b(sin|cos|tan|log|ln)\b/g, '\\$1 ');
  return s;
}

/** KaTeX HTML for one line of maths, or null if KaTeX can't parse it (the caller falls back). */
export function renderKatex(text: string): string | null {
  try {
    return katex.renderToString(toLatex(text), { throwOnError: true, output: 'html', strict: 'ignore' });
  } catch {
    return null;
  }
}

/** KaTeX HTML for a bare fraction like 30/7 or a mixed number like 4 2/7 inside prose. */
export function renderKatexFraction(num: string, den: string, whole?: string, sign?: string): string | null {
  const tex = `${sign === '-' || sign === '−' ? '-' : ''}${whole ?? ''}\\frac{${num}}{${den}}`;
  try {
    return katex.renderToString(tex, { throwOnError: true, output: 'html' });
  } catch {
    return null;
  }
}
