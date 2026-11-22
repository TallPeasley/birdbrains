/**
 * Is a student's typed answer the same as the worksheet's expected answer?
 *
 * Students type plain text ("x = -3, 5", "3/4", "sqrt(2)"); worksheets store LaTeX-ish text
 * ("x = -3 \text{ or } x = 5", "\frac{3}{4}"). Both are reduced to the same plain form, split into
 * their values ("x = 2 or x = -5" is two values, order free), and each value matches as text or as
 * a number ("0.75" = "3/4", "2.0" = "2").
 */

/** LaTeX and symbols to plain, compact, lower-case text. */
export function plainAnswer(s: string): string {
  let t = s;
  for (let i = 0; i < 3; i++) t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  for (let i = 0; i < 3; i++) t = t.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
  return t
    .replace(/\\text\{([^{}]*)\}/g, ' $1 ')
    .replace(/\\left|\\right|\\[,;! ]|\$/g, '')
    .replace(/\\cdot|\\times|×|·/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/\\pm|\+-|\+\/-/g, '±')
    .replace(/−|–/g, '-')
    .replace(/\\sqrt/g, 'sqrt')
    .replace(/√\(?/g, 'sqrt(')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** The separate values in an answer: "x=2orx=-5" -> ["2", "-5"]; "x=-2±sqrt(3)" -> two values. */
function values(plain: string): string[] {
  const parts = plain
    .split(/,|;|\bor\b|\band\b|(?<=\d|\))or(?=[a-z-]|\d)|(?<=\d|\))and(?=[a-z-]|\d)/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    // Drop one leading "x=" (a single unknown): "x=4" and "4" are the same answer.
    const v = p.replace(/^[a-z]=/, '');
    const pm = v.split('±');
    if (pm.length === 2) out.push(`${pm[0]}+${pm[1]}`, `${pm[0]}-${pm[1]}`);
    else out.push(v);
  }
  return out;
}

/** The number a plain arithmetic expression stands for ("3/4", "-2+sqrt(9)", "2^3"), or null. */
export function numberOf(plain: string): number | null {
  if (!plain || !/^[0-9+\-*/().^sqrt]+$/.test(plain)) return null;
  if (/[a-z]/.test(plain.replace(/sqrt/g, ''))) return null;
  // Implicit multiplication between a number or ")" and "(" or sqrt: "2sqrt(3)", "2(3)".
  const js = plain
    .replace(/(\d|\))(?=\(|sqrt)/g, '$1*')
    .replace(/\)(?=\d)/g, ')*')
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/\^/g, '**');
  try {
    const n = Function(`"use strict"; return (${js});`)() as unknown;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const close = (x: number, y: number) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));

/** Two expressions in the same one letter ("(x+3)(x-5)", "x^2-2x-15") are equal at a few test points. */
function sameExpression(a: string, b: string): boolean {
  const letters = (s: string) => new Set(s.replace(/sqrt/g, '').match(/[a-z]/g) ?? []);
  const la = letters(a);
  const lb = letters(b);
  if (la.size !== 1 || lb.size !== 1) return false;
  const [v] = [...la];
  if (!lb.has(v)) return false;
  const at = (s: string, x: number) => numberOf(s.split(v).join(`(${x})`));
  return [1.37, -0.61, 2.53].every((x) => {
    const p = at(a, x);
    const q = at(b, x);
    return p !== null && q !== null && close(p, q);
  });
}

function sameValue(a: string, b: string): boolean {
  if (a === b) return true;
  const x = numberOf(a);
  const y = numberOf(b);
  if (x !== null && y !== null) return close(x, y);
  return sameExpression(a, b);
}

/** Right if the answers hold the same values (any order), each the same as text or as a number. */
export function sameAnswer(given: string, expected: string): boolean {
  if (!given.trim() || !expected.trim()) return false;
  const g = plainAnswer(given);
  const e = plainAnswer(expected);
  if (g === e || sameValue(g.replace(/^[a-z]=/, ''), e.replace(/^[a-z]=/, ''))) return true;
  const gv = values(g);
  const ev = values(e);
  if (gv.length !== ev.length || ev.length === 0) return false;
  const left = [...ev];
  for (const v of gv) {
    const k = left.findIndex((w) => sameValue(v, w));
    if (k === -1) return false;
    left.splice(k, 1);
  }
  return true;
}

/** One expected answer per blank: "4" for every box, or "4, 9" for two boxes. */
export function expectedBlanks(placeholder: string | null | undefined, count: number): string[] {
  if (!placeholder) return [];
  const parts = placeholder.split(/\s*[,;]\s*/);
  return count > 1 && parts.length === count ? parts : Array(count).fill(placeholder);
}
