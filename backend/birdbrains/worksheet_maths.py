"""Checks the maths of a generated worksheet with sympy before a student sees it.

The model is told to check every number, but nothing verified it. A practice sheet
whose worked step or expected answer is wrong teaches the mistake, so the Faded
Scaffolding section is checked line by line (blanks filled with their expected
answers):

* a line of plain numbers ("(6/2)^2 = 9") must be true, allowing for the rounding
  the line itself shows;
* two lines in a row that both define the same thing ("y = 3(x^2 + 4x) + 1", then
  "y = 3(x + 2)^2 - 11") must be equal for every x;
* two lines in a row that are equations in the same one unknown ("3x + 4 = 19",
  then "3x = 15") must not give the later line an answer the earlier one doesn't
  have (dropping one root, as in "x - 2 = 0" after "(x - 2)(x - 3) = 0", is fine).

Anything it cannot read with confidence (words, trig, inequalities, "or", several
statements on a line) is skipped, never failed: a false alarm costs a student a day.
"""
from __future__ import annotations

import re
from typing import Optional

from .math_lint import BLANK
from .schemas import WorksheetContent

_SKIP = re.compile(r"[<>≤≥≈±]|\\(le|ge|leq|geq|approx|pm|sin|cos|tan|log|ln|text)\b|\b(or|and|sin|cos|tan|log)\b"
                   r"|=>|⇒|\\Rightarrow|\\implies|[,;]")
_ALLOWED = re.compile(r"^[0-9a-zA-Z+\-*/^().=\s]+$")


def _clean(text: str) -> Optional[str]:
    """Plain, parseable maths from one worksheet line, or None to skip it."""
    t = text.strip()
    if ":" in t:  # "Group and factor out 3: y = 3(x^2 + 4x) + 1"
        t = t.rsplit(":", 1)[1].strip()
    t = t.strip("$ ").rstrip(".")
    # A unit after the last number ("r = 5.9 cm", "A = 12 m^2", "52°") is not maths.
    t = re.sub(r"(\d)\s*(?:\\text\{\s*)?(?:mm|cm|km|m|kg|g|mL|L|s|min|h)(?:\^\{?[23]\}?)?\}?\s*$", r"\1", t)
    t = re.sub(r"(\d)\s*(?:°|\^\{?\\circ\}?)", r"\1", t)
    if not t or _SKIP.search(t):
        return None
    if "=" not in t and not re.search(r"[a-zA-Z]", t.replace("sqrt", "")):
        return None  # a bare number ("17") says nothing to check
    for _ in range(3):
        t = re.sub(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}", r"((\1)/(\2))", t)
        t = re.sub(r"\\sqrt\{([^{}]*)\}", r"sqrt(\1)", t)
    t = (t.replace("\\left", "").replace("\\right", "").replace("\\cdot", "*").replace("\\times", "*")
         .replace("×", "*").replace("·", "*").replace("\\div", "/").replace("÷", "/").replace("−", "-")
         .replace("{", "(").replace("}", ")"))
    t = t.replace("sqrt(", "§(")
    if not _ALLOWED.match(t.replace("§", "")):
        return None
    words = re.findall(r"[A-Za-z]{2,}", t)
    if words:  # "Vertex", "pi": not a single-letter unknown, so not ours to read
        return None
    return t.replace("§(", "sqrt(")


def _parse_sides(text: str):
    import sympy
    from sympy.parsing.sympy_parser import (convert_xor, implicit_multiplication_application, parse_expr,
                                            standard_transformations)

    clean = _clean(text)
    if clean is None:
        return None
    tf = standard_transformations + (implicit_multiplication_application, convert_xor)
    try:
        sides = [parse_expr(s, transformations=tf, evaluate=True) for s in clean.split("=")]
    except Exception:
        return None
    if any(not isinstance(s, sympy.Expr) for s in sides):
        return None
    if any(len(str(sym)) != 1 for s in sides for sym in s.free_symbols):
        return None
    return sides


def _decimals(text: str) -> int:
    found = [len(m) for m in re.findall(r"\d\.(\d+)", text)]
    return max(found) if found else -1


def _numeric_problem(text: str, sides) -> Optional[str]:
    values = []
    for s in sides:
        try:
            values.append(complex(s.evalf()))
        except Exception:
            return None
    d = _decimals(text)
    tol = 0.5 * 10 ** -d + 1e-9 if d >= 0 else 1e-9
    first = values[0]
    for v in values[1:]:
        if abs(v - first) > tol * max(1.0, abs(first.real) if d < 0 else 1.0):
            return f"'{text.strip()}' is not true"
    return None


def _as_expression(sides):
    """(name, expr) for a line that is one expression: "3(x^2 + 5x + 6)" gives
    (None, expr) and "y = 3(x + 2)^2 - 11" gives (y, expr). None for anything else,
    such as an equation to solve ("3x + 4 = 19")."""
    import sympy

    if len(sides) == 1:
        return None, sides[0]
    if len(sides) == 2 and isinstance(sides[0], sympy.Symbol) and sides[0] not in sides[1].free_symbols:
        return sides[0], sides[1]
    return None


def _same_function(a, b) -> Optional[bool]:
    """Both lines are the same expression rewritten ("y = <expr>" twice for the same y, or
    a bare expression after another, as in factoring): are they equal for every value?"""
    import sympy

    ea, eb = _as_expression(a), _as_expression(b)
    if ea is None or eb is None:
        return None
    (na, xa), (nb, xb) = ea, eb
    if len(a) == 2 and len(b) == 2 and na != nb:
        return None
    if xa.free_symbols != xb.free_symbols or not xa.free_symbols:
        return None
    if len(a) == 1 and len(b) == 1 or na == nb:
        return sympy.simplify(sympy.expand(xa - xb)) == 0
    return None


def _roots(sides):
    import sympy

    syms = set().union(*(s.free_symbols for s in sides))
    if len(syms) != 1 or len(sides) != 2:
        return None, None
    x = syms.pop()
    expr = sides[0] - sides[1]
    if not expr.is_polynomial(x) or sympy.degree(expr, x) < 1 or sympy.degree(expr, x) > 4:
        return None, None
    try:
        return x, {r for r in sympy.solve(sympy.Eq(sides[0], sides[1]), x) if r.is_real}
    except Exception:
        return None, None


def _filled(content: str, answer: Optional[str]) -> Optional[str]:
    n = content.count(BLANK)
    if not n:
        return content
    if not answer or not answer.strip():
        return None
    parts = [answer.strip()] * n
    if n > 1 and re.search(r"[,;]", answer):
        parts = [p.strip() for p in re.split(r"[,;]", answer)]
        if len(parts) != n:
            return None
    out = content
    for p in parts:
        out = out.replace(BLANK, f"({p})", 1)
    return out


def check_worksheet_maths(ws: WorksheetContent) -> list[str]:
    return maths_report(ws)[0]


def maths_report(ws: WorksheetContent) -> tuple[list[str], int, int]:
    """(problems, steps it could read, steps). An empty problem list with few steps read
    means "not checked", not "correct", so callers log the counts."""
    problems: list[str] = []
    checked = 0
    previous = None
    for step in ws.faded_scaffolding:
        line = _filled(step.given_content, step.blank_placeholder)
        sides = _parse_sides(line) if line else None
        where = f"step {step.step_number}"
        if sides is None:
            previous = None
            continue
        checked += 1
        if not set().union(*(s.free_symbols for s in sides)):
            p = _numeric_problem(line, sides)
            if p:
                problems.append(f"{where}: {p}")
        elif previous is not None:
            same = _same_function(previous, sides)
            if same is False:
                problems.append(f"{where}: does not follow from the step before")
            elif same is None:
                x1, before = _roots(previous)
                x2, after = _roots(sides)
                if before is not None and after is not None and x1 == x2 and d_extra(after, before, line):
                    problems.append(f"{where}: gives an answer the step before does not have")
        previous = sides
    return problems, checked, len(ws.faded_scaffolding)


def d_extra(after: set, before: set, text: str) -> bool:
    """True when the later line has a root that is not a root of the earlier line."""
    d = _decimals(text)
    tol = 0.5 * 10 ** -d + 1e-9 if d >= 0 else 1e-9
    return any(all(abs(complex(r.evalf()) - complex(b.evalf())) > tol for b in before) for r in after)
