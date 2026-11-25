"""Printable PDF of a 3-stage worksheet (Phase 4.3), rendered with WeasyPrint.

Sections A to D for the student, then an answer key on its own page. Maths is
typeset (pdf_math: matplotlib mathtext as inline SVG), never printed as raw sqrt( or ^.
"""
from __future__ import annotations

import re
from html import escape

from .pdf_math import math_html, prose_html
from .schemas import ApiWorksheet

CSS = """
@page { size: Letter; margin: 18mm 16mm; @bottom-center { content: "Quark  ·  page " counter(page); font-size: 8pt; color: #777; } }
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }
h1 { font-size: 17pt; margin: 0 0 2mm; }
h2 { font-size: 12.5pt; margin: 7mm 0 2mm; padding-bottom: 1mm; border-bottom: 1.5pt solid #111; }
.sub { color: #444; margin: 0 0 3mm; }
.meta { display: flex; gap: 10mm; font-size: 10pt; margin-bottom: 2mm; }
.meta span { border-bottom: 0.75pt solid #111; flex: 1; padding-bottom: 5mm; }
.box { border: 0.75pt solid #999; border-radius: 2mm; padding: 3mm 4mm; margin: 3mm 0; break-inside: avoid; }
.math { font-family: "DejaVu Sans Mono", monospace; font-size: 10.5pt; }
.label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #555; }
.hint { font-size: 9.5pt; color: #444; font-style: italic; }
.work { height: 28mm; border: 0.75pt dashed #999; border-radius: 2mm; margin-top: 2mm; }
.work.big { height: 85mm; }
ul.check { list-style: none; padding: 0; } ul.check li::before { content: "\\2610  "; font-size: 13pt; }
img.eq { vertical-align: middle; }
.prob { margin: 3mm 0; break-inside: avoid; }
.prob .work { height: 30mm; }
.tag { float: right; font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #555; border: 0.5pt solid #999; border-radius: 1mm; padding: 0 1.5mm; }
.answers { break-before: page; }
h3 { font-size: 11.5pt; margin: 5mm 0 1.5mm; }
.key { margin: 1.5mm 0 2.5mm; break-inside: avoid; }
.sol { font-size: 10pt; color: #333; margin-left: 6mm; }
"""


DIFFICULTY = {"WARM_UP": "Warm-up", "CORE": "Core", "STRETCH": "Stretch"}


def _solution_lines(text: str) -> str:
    return "".join(f'<div class="sol">{prose_html(line.strip(), 10)}</div>'
                   for line in re.split(r"\s;\s|\n", text or "") if line.strip())


def render_html(ws: ApiWorksheet) -> str:
    """Sections A to D for the student, then an answer key on its own page."""
    e, m, p = escape, math_html, prose_html
    a = "".join(
        '<div class="box">'
        + (f'<div class="label">Your step before</div><div>{m(x.previousStepText)}</div>' if x.previousStepText else "")
        + f'<div class="label">Your step{" with the mistake" if x.previousStepText else ""}</div><div>{m(x.originalStepText)}</div>'
        + (f'<p><strong>What went wrong:</strong> {p(x.whatWentWrong)}</p>' if x.whatWentWrong else "")
        + f'<div class="label" style="margin-top:2mm">Corrected</div><div>{m(x.annotatedCorrection)}</div>'
        f'<p><strong>Key takeaway:</strong> {p(x.keyTakeaway)}</p></div>'
        for x in ws.sectionA_DiagnosticMirror
    )
    steps = ws.sectionB_FadedScaffolding
    b = "".join(
        f'<div class="box"><div class="label">Step {s.stepNumber}'
        f'{" · worked for you" if s.scaffoldingType == "GIVEN" else " · fill in the blanks" if s.scaffoldingType == "PARTIAL_BLANK" else " · your turn"}'
        f'</div><p>{p(s.prompt)}</p>'
        + (f'<div>{m(s.givenContent)}</div>' if s.scaffoldingType != "INDEPENDENT" else '<div class="work"></div>')
        + f'<p class="hint">Hint: {p(s.hint)}</p></div>'
        for s in steps
    )
    c = ws.sectionC_IndependentTransfer
    checks = "".join(f"<li>{p(x)}</li>" for x in c.metacognitiveChecklist)
    d = "".join(
        f'<div class="prob"><span class="tag">{DIFFICULTY.get(q.difficulty, "")}</span>'
        f'<strong>{q.number}.</strong> {p(q.problemStatement)}<div class="work"></div></div>'
        for q in ws.sectionD_PracticeSet
    )

    key_b = "".join(
        f'<div class="key"><strong>Step {s.stepNumber}:</strong> '
        + (m(s.blankPlaceholder or "") if s.scaffoldingType == "PARTIAL_BLANK" else m(s.givenContent))
        + "</div>"
        for s in steps if s.scaffoldingType != "GIVEN"
    )
    key_c = (f'<div class="key"><strong>Answer:</strong> {m(c.answer)}{_solution_lines(c.workedSolution)}</div>'
             if c.answer else '<p class="hint">No answer key was made for this older worksheet.</p>')
    key_d = "".join(
        f'<div class="key"><strong>{q.number}.</strong> {m(q.answer)}{_solution_lines(q.workedSolution)}</div>'
        for q in ws.sectionD_PracticeSet
    )
    practice = (f"<h2>D. Practice set</h2><p class=\"sub\">Warm-up first, then core, then stretch. "
                f"Show your steps.</p>{d}") if d else ""
    key_practice = f"<h3>D. Practice set</h3>{key_d}" if key_d else ""
    return (
        f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
        f'<div class="meta"><span>Name</span><span>Date</span></div>'
        f"<h1>{p(ws.title)}</h1><p class=\"sub\">{p(ws.targetConcept)}</p>"
        f"<h2>A. Look back at your work</h2>{a}"
        f"<h2>B. Guided practice</h2>{b}"
        f'<h2>C. On your own</h2><p>{p(c.problemStatement)}</p><div class="work big"></div>'
        f'<p class="label">Before you hand it in</p><ul class="check">{checks}</ul>'
        f"{practice}"
        f'<section class="answers"><h1>Answer key</h1><p class="sub">{p(ws.title)}</p>'
        f"<h3>B. Guided practice</h3>{key_b}<h3>C. On your own</h3>{key_c}{key_practice}</section>"
        "</body></html>"
    )


def render_pdf(ws: ApiWorksheet) -> bytes:
    from weasyprint import HTML  # imported here: needs Pango, which only the container image has

    return HTML(string=render_html(ws)).write_pdf()
