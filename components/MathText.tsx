import React from 'react';
import { hasFraction, isWordy, renderKatex, renderKatexFraction } from '@/lib/katexMath';

/**
 * LaTeX / KaTeX-style mathematical & numeric renderer for BirdBrains.
 *
 * Ensures:
 * 1. All numeric text (scores, counts, percentages, negative numbers, step numbers)
 *    renders in LaTeX mathematical serif typography (.latex-num / .latex-math) instead of plain text.
 * 2. All mathematical expressions (whether Stage 1/2 LaTeX or plain-text notation like
 *    "(4+1)^2", "y = 2(x + 3)^2 - 9 + 5", "(6/2)^2 = 9", "\frac{a}{b}", "\cancel{...}")
 *    render with proper LaTeX superscripts, subscripts, fractions, radicals, italic variables,
 *    and true mathematical operators — never displaying a raw "^" character.
 */

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  'ⁿ': 'n',
};

const LATEX_SYMBOLS: Record<string, string> = {
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  Rightarrow: '⇒',
  implies: '⇒',
  rightarrow: '→',
  to: '→',
  leftarrow: '←',
  iff: '⇔',
  Leftrightarrow: '⇔',
  infty: '∞',
  pi: 'π',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  Delta: 'Δ',
  sigma: 'σ',
  Sigma: '∑',
  lambda: 'λ',
  mu: 'μ',
  omega: 'ω',
  Omega: 'Ω',
  degree: '°',
  circ: '°',
  prime: '′',
  '%': '%',
  '{': '{',
  '}': '}',
};

const MATH_FUNCTIONS = new Set(['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'log', 'ln', 'lim', 'max', 'min', 'exp']);

/** Normalize unicode superscripts into ^{...} so they render uniformly as LaTeX superscripts. */
function normalizeUnicodeSuperscripts(input: string): string {
  return input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+/g, (match) => {
    const mapped = Array.from(match)
      .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
      .join('');
    return `^{${mapped}}`;
  });
}

/** Extract content inside balanced delimiters (e.g. {...}, (...), [...]) starting at index `start`. */
function extractBalanced(str: string, start: number, openChar: string, closeChar: string): { content: string; nextIndex: number } | null {
  if (str[start] !== openChar) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++;
      continue;
    }
    if (str[i] === openChar) depth++;
    else if (str[i] === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(start + 1, i),
          nextIndex: i + 1,
        };
      }
    }
  }
  // Unclosed delimiter: consume to end so we never leave raw syntax or ^ behind
  return {
    content: str.slice(start + 1),
    nextIndex: str.length,
  };
}

/** Check whether the text inside parentheses looks like a mathematical expression rather than an English aside. */
function isMathParenContent(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed) return false;
  // Contains numbers, math operators, carets, slashes, or single-letter algebra like "x - h" or "4+1"
  if (/[\d^=+*/<>\\]/.test(trimmed)) return true;
  if (/^[a-zA-Z]\s*[-+*/=]\s*[a-zA-Z0-9]/.test(trimmed)) return true;
  if (/^-[a-zA-Z0-9]+$/.test(trimmed)) return true;
  return false;
}

/** Determine whether a single letter at `pos` in `str` is acting as a mathematical variable. */
function isSingleLetterMathVar(str: string, pos: number, strictMath: boolean): boolean {
  const ch = str[pos];
  if (!/[a-zA-Z]/.test(ch)) return false;

  const prev = pos > 0 ? str[pos - 1] : '';
  const next = pos + 1 < str.length ? str[pos + 1] : '';

  // Must not be part of a multi-letter word
  if (/[a-zA-Z]/.test(prev) || /[a-zA-Z]/.test(next)) return false;

  if (strictMath) return true;

  // Directly followed by ^ or _ or ( in math context, e.g. x^2, a(x - h)^2, f(x)
  const restAfter = str.slice(pos + 1);
  if (/^\s*[\^_]/.test(restAfter)) return true;
  if (next === '(') {
    const group = extractBalanced(str, pos + 1, '(', ')');
    if (group && (isMathParenContent(group.content) || /^\s*\^/.test(str.slice(group.nextIndex)))) {
      return true;
    }
  }

  // Adjacent to math operators (=, +, -, *, /, <, >) or inside math parens
  const beforeTrim = str.slice(0, pos).trimEnd();
  const afterTrim = str.slice(pos + 1).trimStart();

  if (/[=+*/<>−×÷]$/.test(beforeTrim) || /^[=+*/<>−×÷^]/.test(afterTrim)) return true;
  if (/-\s*$/.test(str.slice(0, pos)) && (/[=(+\-*/]/.test(beforeTrim.slice(0, -1)) || next === ')' || next === '^')) {
    return true;
  }
  if (/^\s*-\s*[a-zA-Z0-9(]/.test(str.slice(pos + 1)) && (prev === '(' || /[=+]/.test(beforeTrim))) {
    return true;
  }

  // Single lowercase letters x, y, z in math-heavy strings
  if ((ch === 'x' || ch === 'y' || ch === 'z') && !['a', 'i', 'A', 'I'].includes(ch)) {
    return true;
  }

  return false;
}

/**
 * Core recursive LaTeX AST renderer.
 * Converts any string (strict math or mixed prose+math) into React nodes with zero raw `^`.
 */
function renderLatexNodes(rawInput: string, strictMath: boolean, keyPrefix = 'm'): React.ReactNode[] {
  if (!rawInput) return [];

  let str = normalizeUnicodeSuperscripts(rawInput);
  // Strip outer $...$ or \(...\) if the whole string is wrapped in them
  if (strictMath) {
    str = str
      .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
      .replace(/^\$([\s\S]*)\$$/, '$1')
      .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
      .replace(/^\\\(([\s\S]*)\\\)$/, '$1');
  }

  const nodes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  const nextKey = () => `${keyPrefix}-${k++}`;

  while (i < str.length) {
    const rest = str.slice(i);

    // 1. Explicit inline/display LaTeX delimiters in prose: $$...$$, $...$, \[...\], \(...\)
    if (!strictMath) {
      if (rest.startsWith('$$')) {
        const end = rest.indexOf('$$', 2);
        if (end !== -1) {
          const inner = rest.slice(2, end);
          nodes.push(
            <span key={nextKey()} className="latex-math">
              {renderLatexNodes(inner, true, nextKey())}
            </span>
          );
          i += end + 2;
          continue;
        }
      }
      if (rest.startsWith('$') && !rest.startsWith('$ ')) {
        const end = rest.indexOf('$', 1);
        if (end !== -1) {
          const inner = rest.slice(1, end);
          const html = renderKatex(inner);
          if (html) {
            nodes.push(<span key={nextKey()} className="bb-katex" dangerouslySetInnerHTML={{ __html: html }} />);
            i += end + 1;
            continue;
          }
          nodes.push(
            <span key={nextKey()} className="latex-math">
              {renderLatexNodes(inner, true, nextKey())}
            </span>
          );
          i += end + 1;
          continue;
        }
      }
      if (rest.startsWith('\\(')) {
        const end = rest.indexOf('\\)', 2);
        if (end !== -1) {
          const inner = rest.slice(2, end);
          nodes.push(
            <span key={nextKey()} className="latex-math">
              {renderLatexNodes(inner, true, nextKey())}
            </span>
          );
          i += end + 2;
          continue;
        }
      }
      if (rest.startsWith('\\[')) {
        const end = rest.indexOf('\\]', 2);
        if (end !== -1) {
          const inner = rest.slice(2, end);
          nodes.push(
            <span key={nextKey()} className="latex-math">
              {renderLatexNodes(inner, true, nextKey())}
            </span>
          );
          i += end + 2;
          continue;
        }
      }
    }

    // 2. Preserve worksheet fill-in-the-blank marker "[ __ ]" intact
    if (rest.startsWith('[ __ ]')) {
      nodes.push(<span key={nextKey()}>[ __ ]</span>);
      i += 6;
      continue;
    }

    // 3. Protected curriculum / taxonomy codes (e.g. PRC_STEP_OMITTED, CON-01, MTH1W, MPM2D, LEVEL_3, tp_quad_99)
    const codeMatch = rest.match(/^((?:CON|STR|PRC|FAC|COM|TST)(?:-0[1-9]|_[A-Z][A-Z_]*)|MTH1W|MPM2D|EQAO|tp_[A-Za-z0-9_]+|grd_[A-Za-z0-9_]+|sub_[A-Za-z0-9_]+|stu_[A-Za-z0-9_]+|wks_[A-Za-z0-9_]+)\b/);
    if (codeMatch) {
      const token = codeMatch[1];
      // Render digits within the code in .latex-num while keeping letters intact
      const parts = token.split(/(\d+)/);
      nodes.push(
        <span key={nextKey()} className="whitespace-nowrap">
          {parts.map((p, idx) =>
            /^\d+$/.test(p) ? (
              <span key={idx} className="latex-num">
                {p}
              </span>
            ) : (
              <React.Fragment key={idx}>{p}</React.Fragment>
            )
          )}
        </span>
      );
      i += token.length;
      continue;
    }

    // 4. LaTeX commands starting with "\"
    if (str[i] === '\\') {
      const cmdMatch = rest.match(/^\\([a-zA-Z]+|[,;!%{} ])/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        let cursor = i + cmdMatch[0].length;

        // \left and \right sizing prefixes
        if (cmd === 'left' || cmd === 'right') {
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          if (str.slice(cursor, cursor + 2) === '\\{' || str.slice(cursor, cursor + 2) === '\\}') {
            nodes.push(
              <span key={nextKey()} className="latex-delim">
                {str[cursor + 1]}
              </span>
            );
            i = cursor + 2;
            continue;
          }
          if (cursor < str.length && '()[]|'.includes(str[cursor])) {
            nodes.push(
              <span key={nextKey()} className="latex-delim">
                {str[cursor]}
              </span>
            );
            i = cursor + 1;
            continue;
          }
          i = cursor;
          continue;
        }

        // \frac{num}{den}, \dfrac{num}{den}, \tfrac{num}{den}
        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          const numGroup = extractBalanced(str, cursor, '{', '}');
          if (numGroup) {
            cursor = numGroup.nextIndex;
            while (cursor < str.length && str[cursor] === ' ') cursor++;
            const denGroup = extractBalanced(str, cursor, '{', '}');
            if (denGroup) {
              nodes.push(
                <span key={nextKey()} className="latex-frac" role="math">
                  <span className="latex-frac-num">{renderLatexNodes(numGroup.content, true, nextKey())}</span>
                  <span className="latex-frac-bar" aria-hidden="true" />
                  <span className="latex-frac-den">{renderLatexNodes(denGroup.content, true, nextKey())}</span>
                </span>
              );
              i = denGroup.nextIndex;
              continue;
            }
          }
        }

        // \sqrt[n]{x} or \sqrt{x}
        if (cmd === 'sqrt') {
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          let indexGroup: { content: string; nextIndex: number } | null = null;
          if (str[cursor] === '[') {
            indexGroup = extractBalanced(str, cursor, '[', ']');
            if (indexGroup) cursor = indexGroup.nextIndex;
          }
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          const radGroup = extractBalanced(str, cursor, '{', '}');
          if (radGroup) {
            nodes.push(
              <span key={nextKey()} className="latex-sqrt">
                {indexGroup && <sup className="latex-sqrt-idx">{renderLatexNodes(indexGroup.content, true, nextKey())}</sup>}
                <span className="latex-sqrt-sign" aria-hidden="true">
                  √
                </span>
                <span className="latex-sqrt-body">{renderLatexNodes(radGroup.content, true, nextKey())}</span>
              </span>
            );
            i = radGroup.nextIndex;
            continue;
          }
        }

        // \cancel{...}, \bcancel{...}, \xcancel{...}, \sout{...}
        if (cmd === 'cancel' || cmd === 'bcancel' || cmd === 'xcancel' || cmd === 'sout') {
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          const bodyGroup = extractBalanced(str, cursor, '{', '}');
          if (bodyGroup) {
            nodes.push(
              <span key={nextKey()} className="latex-cancel">
                {renderLatexNodes(bodyGroup.content, true, nextKey())}
              </span>
            );
            i = bodyGroup.nextIndex;
            continue;
          }
        }

        // \text{...}, \mathrm{...}, \operatorname{...}, \mathbf{...}, \textbf{...}, \mathit{...}
        if (['text', 'mathrm', 'operatorname', 'mathbf', 'textbf', 'mathit', 'textit'].includes(cmd)) {
          while (cursor < str.length && str[cursor] === ' ') cursor++;
          const txtGroup = extractBalanced(str, cursor, '{', '}');
          if (txtGroup) {
            const cls =
              cmd === 'mathbf' || cmd === 'textbf'
                ? 'font-semibold'
                : cmd === 'mathit' || cmd === 'textit'
                  ? ' latex-var'
                  : 'latex-num';
            nodes.push(
              <span key={nextKey()} className={cls}>
                {renderLatexNodes(txtGroup.content, false, nextKey())}
              </span>
            );
            i = txtGroup.nextIndex;
            continue;
          }
        }

        // Spacing commands
        if (cmd === 'quad' || cmd === 'qquad' || cmd === ',' || cmd === ';' || cmd === ' ') {
          nodes.push(<span key={nextKey()}>&nbsp;</span>);
          i = cursor;
          continue;
        }
        if (cmd === '!') {
          i = cursor;
          continue;
        }

        // Known symbols (\times, \pi, \Rightarrow, etc.)
        if (cmd in LATEX_SYMBOLS) {
          nodes.push(
            <span key={nextKey()} className="latex-op">
              {LATEX_SYMBOLS[cmd]}
            </span>
          );
          i = cursor;
          continue;
        }

        // Any other \command (\overline{AB}, \angle, \vec{v} ...): let KaTeX typeset it with its {...} arguments.
        {
          let end = cursor;
          for (let g = extractBalanced(str, end, '{', '}'); g; g = extractBalanced(str, end, '{', '}')) end = g.nextIndex;
          const html = renderKatex(str.slice(i, end));
          if (html) {
            nodes.push(<span key={nextKey()} className="bb-katex" dangerouslySetInnerHTML={{ __html: html }} />);
            i = end;
            continue;
          }
        }

        // Fallback for any other \command: render command name cleanly without backslash
        nodes.push(
          <span key={nextKey()} className="latex-num">
            {cmd}
          </span>
        );
        i = cursor;
        continue;
      }
      // Stray backslash
      i++;
      continue;
    }

    // 5. Parenthesized group (...) — check if it's a math group or followed by ^exponent like (4+1)^2 or (6/2)^2
    if (str[i] === '(') {
      const group = extractBalanced(str, i, '(', ')');
      if (group) {
        const afterGroup = str.slice(group.nextIndex);
        const hasExponentAfter = /^\s*\^/.test(afterGroup);
        const innerIsMath = strictMath || hasExponentAfter || isMathParenContent(group.content);

        // Special case: simple numeric fraction inside parentheses like (6/2)^2 -> render 6/2 as stacked LaTeX fraction!
        const simpleFracMatch = group.content.trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
        if (innerIsMath && simpleFracMatch) {
          // Typeset "(6/2)^2" whole with KaTeX: brackets sized to the fraction, exponent attached.
          const expMatch = afterGroup.match(/^\s*\^\s*(\{[^}]*\}|-?[\w.]+)/);
          const exp = expMatch ? expMatch[1].replace(/^\{|\}$/g, '') : '';
          const html = renderKatex(`\\left(\\frac{${simpleFracMatch[1]}}{${simpleFracMatch[2]}}\\right)${exp ? `^{${exp}}` : ''}`);
          if (html) {
            nodes.push(<span key={nextKey()} className="bb-katex" dangerouslySetInnerHTML={{ __html: html }} />);
            i = group.nextIndex + (expMatch ? expMatch[0].length : 0);
            continue;
          }
        }

        if (innerIsMath) {
          nodes.push(
            <span key={nextKey()} className="latex-math">
              <span className="latex-delim">(</span>
              {renderLatexNodes(group.content, true, nextKey())}
              <span className="latex-delim">)</span>
            </span>
          );
          i = group.nextIndex;
          continue;
        }
      }
    }

    // 6. Exponent "^" — NEVER allow a raw "^" character to render!
    if (str[i] === '^') {
      let cursor = i + 1;
      while (cursor < str.length && str[cursor] === ' ') cursor++;

      if (cursor >= str.length) {
        // Trailing ^ at end of input
        i = cursor;
        continue;
      }

      if (str[cursor] === '{') {
        const expGroup = extractBalanced(str, cursor, '{', '}');
        if (expGroup) {
          nodes.push(
            <sup key={nextKey()} className="latex-sup">
              {renderLatexNodes(expGroup.content, true, nextKey())}
            </sup>
          );
          i = expGroup.nextIndex;
          continue;
        }
      }

      if (str[cursor] === '(') {
        const expGroup = extractBalanced(str, cursor, '(', ')');
        if (expGroup) {
          nodes.push(
            <sup key={nextKey()} className="latex-sup">
              {renderLatexNodes(expGroup.content, true, nextKey())}
            </sup>
          );
          i = expGroup.nextIndex;
          continue;
        }
      }

      if (str[cursor] === '\\') {
        const cmdMatch = str.slice(cursor).match(/^\\[a-zA-Z]+/);
        if (cmdMatch) {
          nodes.push(
            <sup key={nextKey()} className="latex-sup">
              {renderLatexNodes(cmdMatch[0], true, nextKey())}
            </sup>
          );
          i = cursor + cmdMatch[0].length;
          continue;
        }
      }

      // Match [+-]? digits/letters (e.g., ^2, ^-2, ^10, ^n, ^x)
      const expToken = str.slice(cursor).match(/^[+-]?[a-zA-Z0-9.]+/);
      if (expToken) {
        nodes.push(
          <sup key={nextKey()} className="latex-sup">
            {renderLatexNodes(expToken[0], true, nextKey())}
          </sup>
        );
        i = cursor + expToken[0].length;
        continue;
      }

      // Any other single char after ^
      nodes.push(
        <sup key={nextKey()} className="latex-sup">
          {renderLatexNodes(str[cursor], true, nextKey())}
        </sup>
      );
      i = cursor + 1;
      continue;
    }

    // 7. Subscript "_" in math context (e.g. x_1, a_{n})
    if (str[i] === '_' && (strictMath || (i > 0 && /[a-zA-Z0-9)]/.test(str[i - 1])))) {
      let cursor = i + 1;
      if (cursor < str.length && str[cursor] === '{') {
        const subGroup = extractBalanced(str, cursor, '{', '}');
        if (subGroup) {
          nodes.push(
            <sub key={nextKey()} className="latex-sub">
              {renderLatexNodes(subGroup.content, true, nextKey())}
            </sub>
          );
          i = subGroup.nextIndex;
          continue;
        }
      }
      const subToken = str.slice(cursor).match(/^[a-zA-Z0-9]+/);
      if (subToken) {
        nodes.push(
          <sub key={nextKey()} className="latex-sub">
            {renderLatexNodes(subToken[0], true, nextKey())}
          </sub>
        );
        i = cursor + subToken[0].length;
        continue;
      }
    }

    // 8. Multi-character plain-text math arrows & relational operators: =>, ->, <=, >=, !=, +-
    const multiOpMatch = rest.match(/^(=>|->|<=|>=|!=|\+-)/);
    if (multiOpMatch) {
      const op = multiOpMatch[1];
      const mapped =
        op === '=>' ? '⇒' : op === '->' ? '→' : op === '<=' ? '≤' : op === '>=' ? '≥' : op === '!=' ? '≠' : '±';
      nodes.push(
        <span key={nextKey()} className="latex-op">
          {mapped}
        </span>
      );
      i += op.length;
      continue;
    }

    // 9. Numeric fraction (6/2, -30/7) or mixed number (4 2/7), typeset by KaTeX.
    //    Not part of a date like 2024/10/24. A sign is only taken when it can't be a binary minus.
    const fracMatch = rest.match(/^([-−]?)(?:(\d+)\s+)?(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?![/\d])/);
    const fracPrev = i > 0 ? str[i - 1] : '';
    if (
      fracMatch &&
      !/[\d/.]/.test(fracPrev) &&
      (!fracMatch[1] || i === 0 || /[\s(=,:]/.test(fracPrev))
    ) {
      const html = renderKatexFraction(fracMatch[3], fracMatch[4], fracMatch[2], fracMatch[1]);
      if (html) {
        nodes.push(<span key={nextKey()} className="bb-katex" dangerouslySetInnerHTML={{ __html: html }} />);
        i += fracMatch[0].length;
        continue;
      }
    }

    // 10. Signed or unsigned number, optionally followed by a single-letter variable (e.g. -4x^2, 2x, 12x, -9, +1, 88%, 8.0)
    // Check if "-" or "+" is a unary sign attached to a number (not a hyphen inside a word like "Carry-Forward" or "4-Pillar")
    const prevChar = i > 0 ? str[i - 1] : '';
    const canBeSignedNumber =
      (str[i] === '-' || str[i] === '−') &&
      /\d/.test(str[i + 1] ?? '') &&
      (i === 0 || /[\s([=+{,;:<>]/.test(prevChar));

    const numVarMatch = canBeSignedNumber
      ? rest.match(/^[-−](\d+(?:\.\d+)?)(%?|[a-zA-Z](?![a-zA-Z]))?/)
      : rest.match(/^(\d+(?:\.\d+)?)(%?|[a-zA-Z](?![a-zA-Z]))?/);

    if (numVarMatch) {
      const fullMatch = numVarMatch[0];
      const digits = numVarMatch[1];
      const suffix = numVarMatch[2] ?? '';
      const isNegative = canBeSignedNumber;
      const afterNum = str.slice(i + fullMatch.length);

      // Avoid turning "4-Pillar" into math variable
      nodes.push(
        <span key={nextKey()} className="latex-math">
          {isNegative && <span className="latex-op-unary">−</span>}
          <span className="latex-num">{digits}</span>
          {suffix === '%' ? (
            <span className="latex-num">%</span>
          ) : suffix ? (
            <var className="latex-var">{suffix}</var>
          ) : null}
        </span>
      );
      i += fullMatch.length;
      // Continue loop (if ^ follows, step 6 will attach <sup className="latex-sup"> immediately!)
      void afterNum;
      continue;
    }

    // 11. Single-character binary math operators in math context: =, +, -, −, *, ×, ÷
    if ('=+-−*×÷'.includes(str[i])) {
      const ch = str[i];
      // Check if "-" is an English hyphen between letters (e.g. "Step-by-step", "Carry-Forward", "growth-mindset")
      const nextChar = i + 1 < str.length ? str[i + 1] : '';
      if (ch === '-' && /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z]/.test(nextChar) && !strictMath) {
        nodes.push(<React.Fragment key={nextKey()}>-</React.Fragment>);
        i++;
        continue;
      }

      if (ch === '*') {
        nodes.push(
          <span key={nextKey()} className="latex-op">
            ×
          </span>
        );
        i++;
        continue;
      }

      if (ch === '-' || ch === '−') {
        // Unary minus before a variable or parenthesis, e.g. -(x + 3) or -x
        const isUnary = i === 0 || /[\s([=+{,;:<>]/.test(prevChar);
        if (isUnary && /[a-zA-Z(]/.test(nextChar)) {
          nodes.push(
            <span key={nextKey()} className="latex-op-unary">
              −
            </span>
          );
          i++;
          continue;
        }
        nodes.push(
          <span key={nextKey()} className="latex-op">
            −
          </span>
        );
        i++;
        continue;
      }

      nodes.push(
        <span key={nextKey()} className="latex-op">
          {ch}
        </span>
      );
      i++;
      continue;
    }

    // 12. Single-letter variable vs multi-letter word
    const wordMatch = rest.match(/^[a-zA-Z]+/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (word.length === 1 && isSingleLetterMathVar(str, i, strictMath)) {
        nodes.push(
          <var key={nextKey()} className="latex-var">
            {word}
          </var>
        );
      } else if (MATH_FUNCTIONS.has(word.toLowerCase()) && (strictMath || /^\s*[(a-zA-Z0-9\\]/.test(rest.slice(word.length)))) {
        nodes.push(
          <span key={nextKey()} className="latex-fn">
            {word}
          </span>
        );
      } else {
        nodes.push(<React.Fragment key={nextKey()}>{word}</React.Fragment>);
      }
      i += word.length;
      continue;
    }

    // 13. Braces { ... } in strict math mode
    if (strictMath && str[i] === '{') {
      const grp = extractBalanced(str, i, '{', '}');
      if (grp) {
        nodes.push(<React.Fragment key={nextKey()}>{renderLatexNodes(grp.content, true, nextKey())}</React.Fragment>);
        i = grp.nextIndex;
        continue;
      }
    }

    // 14. Any other character (spaces, punctuation, brackets)
    nodes.push(<React.Fragment key={nextKey()}>{str[i]}</React.Fragment>);
    i++;
  }

  return nodes;
}

export interface MathTextProps {
  text: string | number | null | undefined;
  /**
   * "auto" (default): parses prose and renders all embedded math expressions, exponents, and numbers in LaTeX.
   * "math": treats the entire input as a mathematical expression / step.
   */
  mode?: 'auto' | 'math';
  className?: string;
}

/**
 * Sentences written before worksheets used $...$ can hold bare maths like "sqrt(25)" or
 * "x1 = -3". Those pieces are wrapped in $...$ so KaTeX typesets them.
 */
function wrapBareMath(text: string): string {
  if (text.includes('$')) return text;
  let out = text.replace(/(^|[^A-Za-z0-9\\_])([a-z])([12])(?![\w.])/g, (_m, pre, v, n) => `${pre}$${v}_${n}$`);
  let at = out.indexOf('sqrt(');
  while (at !== -1) {
    if (at > 0 && out[at - 1] === '\\') {
      at = out.indexOf('sqrt(', at + 5);
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let j = at + 4; j < out.length; j++) {
      if (out[j] === '(') depth++;
      else if (out[j] === ')' && --depth === 0) {
        end = j;
        break;
      }
    }
    if (end === -1) break;
    const piece = `$${out.slice(at, end + 1)}$`;
    out = out.slice(0, at) + piece + out.slice(end + 1);
    at = out.indexOf('sqrt(', at + piece.length);
  }
  return out;
}

export function MathText({ text, mode = 'auto', className }: MathTextProps) {
  if (text === null || text === undefined || text === '') return null;
  if (typeof text === 'number') {
    return <MathNumber value={text} className={className} />;
  }
  const raw = String(text);
  // Lines of maths are typeset whole by KaTeX (sqrt, powers, subscripts, fractions), unless they
  // are mostly words; the hand-built renderer is the fallback when KaTeX can't read a line.
  if (mode === 'math' && (!isWordy(raw) || hasFraction(raw) || /\\[a-zA-Z]/.test(raw))) {
    const html = renderKatex(raw);
    if (html) {
      return <span className={`bb-katex ${className ?? ''}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
    }
  }
  const rendered = renderLatexNodes(mode === 'math' ? raw : wrapBareMath(raw), mode === 'math');
  return <span className={`${mode === 'math' ? 'latex-math ' : ''}${className ?? ''}`.trim()}>{rendered}</span>;
}

export interface MathNumberProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function MathNumber({ value, prefix, suffix, className }: MathNumberProps) {
  const formatted = String(value).replace(/^-/, '−');
  return (
    <span className={`latex-math latex-num ${className ?? ''}`.trim()}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Formats plain-text math strings for native HTML `placeholder` attributes
 * (where DOM <sup/> elements cannot be used), converting ^2 -> ² and - -> −
 * so a raw "^" never appears on screen.
 */
export function formatMathPlaceholder(placeholder: string): string {
  const toSup: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
    n: 'ⁿ',
  };
  return placeholder
    .replace(/\^\{?([0-9+\-n]+)\}?/g, (_, exp: string) =>
      Array.from(exp)
        .map((c) => toSup[c] ?? c)
        .join('')
    )
    .replace(/\^/g, '')
    .replace(/\s-\s/g, ' − ')
    .replace(/(^|\s|\()-(\d|[a-zA-Z])/g, '$1−$2');
}

export default MathText;
