"""Worksheets BirdBrains knows by the code printed on them (for example "BB-W12").

When the reading step sees one of these codes, the printed question text comes from
here instead of from the photo. A blurry or angled photo can then only cost us the
handwriting, never the question itself, so the answer key is built from the real
problem. Add a sheet by adding its code and its numbered questions, word for word.
"""
from __future__ import annotations

import re
from typing import Optional

from .schemas import Stage1TranscriptionOutput

KNOWN_WORKSHEETS: dict[str, dict[str, str]] = {
    "BB-W11": {
        "1": "In \\triangle ABC, \\angle A = 48^\\circ, \\angle B = 67^\\circ and a = 12 cm. "
             "Find \\angle C, b and c. (one decimal place)",
        "2": "In \\triangle ABC, b = 8 m, c = 11 m and \\angle A = 52^\\circ. Find a, then \\angle B and "
             "\\angle C. (one decimal place)",
        "3": "A triangle has sides 8 cm, 10 cm and 12 cm. Find all three angles to the nearest tenth of a degree.",
        "4": "Two ships leave port at the same time. One sails 15 km and the other sails 22 km along "
             "straight paths that form an angle of 62^\\circ. How far apart are the ships? (one decimal place)",
        "5": "A surveyor cannot measure across a pond. She measures AB = 250 m, \\angle CAB = 58^\\circ and "
             "\\angle CBA = 74^\\circ. Find AC and BC to the nearest metre.",
    },
    "BB-W12": {
        "1": "Solve by elimination: 5x - 2y = 16 and 3x + 4y = 20.",
        "2": "Triangle ABC has vertices A(-2, 3), B(4, 7), C(8, 1). (a) Show that \\triangle ABC is a right "
             "isosceles triangle. (b) Find the length of the median from A. (c) Find the area.",
        "3": "(a) Solve 4x^2 - 4x - 15 = 0 by factoring. (b) Write y = 4x^2 - 4x - 15 in vertex form and "
             "state the vertex. (c) Explain how your answers to (a) and (b) agree.",
        "4": "A kite string 50 m long makes a 38^\\circ angle with the ground. The string is held 1.2 m above "
             "the ground. How high is the kite? (one decimal place)",
        "5": "A right triangle has legs x and x + 7 and hypotenuse 13 cm. (a) Find the lengths of the legs. "
             "(b) A similar triangle has hypotenuse 32.5 cm. Find its legs and the ratio of the two areas.",
    },
}


def normalize_code(code: Optional[str]) -> str:
    """"bb w12", "BB–W12" and "BB-W 12" all become "BB-W12"."""
    if not code:
        return ""
    s = re.sub(r"[\s‐-―_]+", "", code.upper()).replace("-", "")
    m = re.fullmatch(r"BBW0*(\d+)", s)
    return f"BB-W{m.group(1)}" if m else ""


def apply_known_worksheet(stage1: Stage1TranscriptionOutput) -> Stage1TranscriptionOutput:
    """Swap in the printed question text for a recognised worksheet code. Only
    questions found on the photo are touched: a photo of half the page is not
    marked down for the half it does not show."""
    sheet = KNOWN_WORKSHEETS.get(normalize_code(stage1.detected_worksheet_code))
    if not sheet:
        return stage1
    questions = [
        q.model_copy(update={"problem_statement": sheet[q.question_number.strip().rstrip(".")]})
        if q.question_number.strip().rstrip(".") in sheet else q
        for q in stage1.questions
    ]
    return stage1.model_copy(update={"questions": questions})
