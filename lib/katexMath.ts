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

/** The blank a worksheet writes for the student to fill in. */
export const BLANK = '[ __ ]';

/** sqrt(...) with any nesting inside, to \sqrt{...}. */
function convertSqrt(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('sqrt(', i);
    if (at === -1 || (at > 0 && text[at - 1] === '\\')) {
      if (at === -1) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, at + 5);
      i = at + 5;
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let j = at + 4; j < text.length; j++) {
      if (text[j] === '(') depth++;
      else if (text[j] === ')' && --depth === 0) {
        end = j;
        break;
      }
    }
    if (end === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at) + '\\sqrt{' + convertSqrt(text.slice(at + 5, end)) + '}';
    i = end + 1;
  }
  return out;
}

/** Things every line gets, LaTeX or not: blanks as boxes, sqrt(...) and x1-style subscripts. */
function commonFixes(text: string, blankLabels: boolean): string {
  let n = 0;
  let s = text;
  while (s.includes(BLANK)) {
    n += 1;
    s = s.replace(BLANK, blankLabels ? `\\boxed{\\,\\scriptsize ${n}\\,}` : '\\boxed{\\phantom{00}}');
  }
  s = convertSqrt(s);
  // x1, y2 (a single letter then one digit) are subscripts in school maths.
  s = s.replace(/(^|[^A-Za-z0-9\\_^{])([a-zA-Z])(\d)(?![\d.])/g, '$1$2_{$3}');
  return s;
}

/** Plain-text school maths ("4 2/7 - 8 = y", "-30/7", "(x+1)/2", "x^2") to LaTeX.
 *  ``blankLabels`` numbers the [ __ ] boxes 1, 2, ... so inputs below can refer to them. */
export function toLatex(text: string, blankLabels = false): string {
  let s = commonFixes(text.trim(), blankLabels);
  if (/\\[a-zA-Z]+/.test(text)) return s; // already LaTeX
  s = s
    .replace(MIXED, (_, pre, whole, n, d) => `${pre}${whole}\\frac{${n}}{${d}}`)
    .replace(FRACTION, (_, n, d) => `\\frac{${unwrap(n)}}{${unwrap(d)}}`)
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\^(-?[\w.]+)/g, '^{$1}')
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

/** A line that is mostly words ("Not isosceles.") is prose, not a formula for KaTeX. */
export function isWordy(text: string): boolean {
  const plain = text.replace(/\\[a-zA-Z]+/g, ' ');
  return /\b(?!(?:sin|cos|tan|log|ln|sqrt)\b)[a-zA-Z]{3,}\b/.test(plain);
}

/** KaTeX HTML for one line of maths, or null if KaTeX can't parse it (the caller falls back). */
export function renderKatex(text: string, blankLabels = false): string | null {
  try {
    return katex.renderToString(toLatex(text, blankLabels), { throwOnError: true, output: 'html', strict: 'ignore' });
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
