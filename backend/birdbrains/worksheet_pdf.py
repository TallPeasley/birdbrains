"""Printable PDF of a 3-stage worksheet (Phase 4.3), rendered with WeasyPrint.

The HTML below is a plain first template. When the print layout from the UI side
lands, replace ``TEMPLATE`` / ``render_html``; nothing else changes. Maths is
printed as the text the model wrote (no typesetting yet).
"""
from __future__ import annotations

from html import escape

from .schemas import ApiWorksheet

CSS = """
@page { size: Letter; margin: 18mm 16mm; @bottom-center { content: "BirdBrains  ·  page " counter(page); font-size: 8pt; color: #777; } }
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
"""


def render_html(ws: ApiWorksheet) -> str:
    e = escape
    a = "".join(
        f'<div class="box"><div class="label">Your step</div><div class="math">{e(m.originalStepText)}</div>'
        f'<div class="label" style="margin-top:2mm">Corrected</div><div class="math">{e(m.annotatedCorrection)}</div>'
        f'<p><strong>Key takeaway:</strong> {e(m.keyTakeaway)}</p></div>'
        for m in ws.sectionA_DiagnosticMirror
    )
    b = "".join(
        f'<div class="box"><div class="label">Step {s.stepNumber}'
        f'{" · worked for you" if s.scaffoldingType == "GIVEN" else " · fill in the blanks" if s.scaffoldingType == "PARTIAL_BLANK" else " · your turn"}'
        f'</div><p>{e(s.prompt)}</p>'
        + (f'<div class="math">{e(s.givenContent)}</div>' if s.scaffoldingType != "INDEPENDENT" else '<div class="work"></div>')
        + f'<p class="hint">Hint: {e(s.hint)}</p></div>'
        for s in ws.sectionB_FadedScaffolding
    )
    c = ws.sectionC_IndependentTransfer
    checks = "".join(f"<li>{e(x)}</li>" for x in c.metacognitiveChecklist)
    return (
        f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
        f'<div class="meta"><span>Name</span><span>Date</span></div>'
        f"<h1>{e(ws.title)}</h1><p class=\"sub\">{e(ws.targetConcept)}</p>"
        f"<h2>A. Look back at your work</h2>{a}"
        f"<h2>B. Guided practice</h2>{b}"
        f'<h2>C. On your own</h2><p>{e(c.problemStatement)}</p><div class="work big"></div>'
        f'<p class="label">Before you hand it in</p><ul class="check">{checks}</ul>'
        "</body></html>"
    )


def render_pdf(ws: ApiWorksheet) -> bytes:
    from weasyprint import HTML  # imported here: needs Pango, which only the container image has

    return HTML(string=render_html(ws)).write_pdf()
