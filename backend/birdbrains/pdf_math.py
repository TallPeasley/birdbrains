"""Typeset maths for the worksheet PDF.

The site draws maths with KaTeX, which needs a browser. The PDF is made by WeasyPrint,
so each formula is drawn here with matplotlib's mathtext as a small inline SVG instead:
square roots, fractions, powers and subscripts look the same as on screen, and a raw
"sqrt(" or "^" never reaches the page. Anything mathtext can't read is printed as
plain text rather than failing the PDF.
"""
from __future__ import annotations

import base64
import io
import re
from functools import lru_cache
from html import escape

BLANK = "[ __ ]"


def _convert_sqrt(text: str) -> str:
    out, i = "", 0
    while True:
        at = text.find("sqrt(", i)
        if at == -1:
            return out + text[i:]
        if at > 0 and text[at - 1] == "\\":
            out += text[i:at + 5]
            i = at + 5
            continue
        depth, end = 0, -1
        for j in range(at + 4, len(text)):
            if text[j] == "(":
                depth += 1
            elif text[j] == ")":
                depth -= 1
                if depth == 0:
                    end = j
                    break
        if end == -1:
            return out + text[i:]
        out += text[i:at] + "\\sqrt{" + _convert_sqrt(text[at + 5:end]) + "}"
        i = end + 1


def _unwrap(cmd: str, text: str) -> str:
    """\\cancel{x} -> x (mathtext has no \\cancel or \\boxed)."""
    pattern = "\\" + cmd + "{"
    while pattern in text:
        at = text.index(pattern)
        depth, j = 0, at + len(pattern) - 1
        for j in range(at + len(pattern) - 1, len(text)):
            depth += (text[j] == "{") - (text[j] == "}")
            if depth == 0:
                break
        text = text[:at] + text[at + len(pattern):j] + text[j + 1:]
    return text


_WORD = re.compile(r"(?<![\\A-Za-z])(?!(?:sin|cos|tan|log|ln|sqrt)\b)[A-Za-z]{3,}")


def to_mathtext(text: str, blank: str = r"\underline{\qquad}") -> str:
    s = text.strip().replace(BLANK, blank)
    if _WORD.search(s):  # "Group and factor out 3: y = ...": words upright, spaces kept
        s = _WORD.sub(lambda m: r"\mathrm{" + m.group(0) + "}", s).replace(" ", r"\ ")
    s = _convert_sqrt(s)
    s = re.sub(r"(^|[^A-Za-z0-9\\_^{])([a-zA-Z])(\d)(?![\d.])", r"\1\2_{\3}", s)
    s = re.sub(r"\^(-?\d+(?:\.\d+)?)", r"^{\1}", s)
    s = re.sub(r"\^\(([^()]*)\)", r"^{\1}", s)
    s = s.replace("*", r"\times ").replace("×", r"\times ").replace("÷", r"\div ").replace("−", "-")
    s = s.replace("≤", r"\leq ").replace("≥", r"\geq ").replace("≠", r"\neq ").replace("±", r"\pm ")
    s = re.sub(r"\\le\b", r"\\leq", s)
    s = re.sub(r"\\ge\b", r"\\geq", s)
    s = re.sub(r"\\(implies|Longrightarrow|longrightarrow)\b", r"\\Rightarrow", s)
    s = re.sub(r"\\[dt]frac\b", r"\\frac", s)
    for cmd in ("cancel", "bcancel", "xcancel", "boxed"):
        s = _unwrap(cmd, s)
    return s


@lru_cache(maxsize=2048)
def _svg(tex: str, size: float) -> str | None:
    from matplotlib.font_manager import FontProperties
    from matplotlib.mathtext import math_to_image

    buf = io.BytesIO()
    try:
        math_to_image(f"${tex}$", buf, format="svg", prop=FontProperties(size=size))
    except Exception:
        return None
    return base64.b64encode(buf.getvalue()).decode()


def math_html(text: str, size: float = 11.0, blank: str = r"\underline{\qquad}") -> str:
    """One formula (a field that is all maths) as an inline image, or escaped text."""
    if not text or not text.strip():
        return ""
    data = _svg(to_mathtext(text, blank), size)
    if data is None:
        return f'<span class="math">{escape(text)}</span>'
    return f'<img class="eq" alt="{escape(text)}" src="data:image/svg+xml;base64,{data}">'


_INLINE = re.compile(r"(?<!\\)\$(.+?)(?<!\\)\$")


_BARE_MATH = re.compile(r"[^\s,;:]*(?:\^|sqrt\(|\b[a-z][12]\b)[^\s,;:]*")


def prose_html(text: str, size: float = 11.0) -> str:
    """A sentence with maths inside $...$: words as text, each $...$ typeset. Older
    worksheets wrote bare maths in sentences ("Convert y = -4x^2 + 24x - 7"): there the
    pieces with ^, sqrt( or x1 are typeset on their own."""
    if not text:
        return ""
    if "$" not in text.replace("\\$", ""):
        text = _BARE_MATH.sub(lambda m: "$" + m.group(0).rstrip(".") + "$" + ("." if m.group(0).endswith(".") else ""), text)
    out, last = [], 0
    for m in _INLINE.finditer(text):
        out.append(escape(text[last:m.start()].replace("\\$", "$")))
        out.append(math_html(m.group(1), size))
        last = m.end()
    out.append(escape(text[last:].replace("\\$", "$")))
    return "".join(out)
