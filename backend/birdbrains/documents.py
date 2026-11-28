"""Slides, PDF booklets and textbook pages sent from the student portal.

Two kinds of batch (POST /submissions/batch):

* ``SLIDES_DECK``: a teacher's slides (.pptx), a PDF booklet or long screenshots. Quark
  reads what they teach and writes a practice set with answers and hints.
* ``TEXTBOOK_ASSIST``: textbook pages (PDF or screenshots). Quark finds the problems and
  writes progressive hints for each, never the full worked answer, plus a way to check.

Files are recognised by their bytes, not their names. PDFs and images go to Gemini as
they are; Gemini cannot read .pptx, so a deck becomes its slide text plus its pictures.
"""
from __future__ import annotations

import io
import logging
import os
import zipfile
from dataclasses import dataclass
from typing import Optional, Protocol, Sequence

from PIL import Image

from . import curricula
from .schemas import (
    SlidesPracticeOutput,
    SlidesPracticeProblem,
    TextbookAssistOutput,
    TextbookProblemHints,
)

log = logging.getLogger(__name__)

PDF = "application/pdf"
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
IMAGE_TYPES = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}
MAX_DECK_PICTURES = 30  # pictures taken from one .pptx (equations are often pasted in as images)
DOCUMENT_MODEL = os.environ.get("BIRDBRAINS_DOCUMENT_MODEL", "")  # empty: use the worksheet model


@dataclass(frozen=True)
class FileKind:
    kind: str  # "pdf", "pptx" or "image"
    mime: str
    ext: str


def sniff(data: bytes) -> Optional[FileKind]:
    """What a file really is, from its bytes. None for anything not accepted."""
    if data.startswith(b"%PDF-"):
        return FileKind("pdf", PDF, "pdf")
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if "ppt/presentation.xml" in z.namelist():
                    return FileKind("pptx", PPTX, "pptx")
        except zipfile.BadZipFile:
            return None
        return None
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            img.verify()
    except Exception:
        return None
    if fmt in IMAGE_TYPES:
        mime, ext = IMAGE_TYPES[fmt]
        return FileKind("image", mime, ext)
    return None


@dataclass(frozen=True)
class DocPart:
    """One piece of what the model reads: text, or a file by bytes (local) or gs:// URI."""

    mime: str = "text/plain"
    text: Optional[str] = None
    data: Optional[bytes] = None
    uri: Optional[str] = None


def pptx_parts(data: bytes, max_pictures: int = MAX_DECK_PICTURES) -> list[DocPart]:
    """A deck as model input: one text part with every slide's text (titles, bullets,
    tables, speaker notes), then up to ``max_pictures`` of its pictures."""
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    deck = Presentation(io.BytesIO(data))
    lines: list[str] = []
    pictures: list[DocPart] = []

    def walk(shapes, slide_no: int, out: list[str]):
        for shape in shapes:
            if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                walk(shape.shapes, slide_no, out)
                continue
            if getattr(shape, "has_text_frame", False) and shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    out.append(text)
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    out.append(" | ".join(cell.text.strip() for cell in row.cells))
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE and len(pictures) < max_pictures:
                try:
                    img = shape.image
                    if img.content_type in ("image/png", "image/jpeg", "image/webp"):
                        pictures.append(DocPart(mime=img.content_type, data=img.blob))
                        out.append(f"[picture {len(pictures)}]")
                except Exception:  # linked or unreadable pictures are skipped
                    pass

    for n, slide in enumerate(deck.slides, start=1):
        out: list[str] = []
        walk(slide.shapes, n, out)
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                out.append(f"Speaker notes: {notes}")
        lines.append(f"--- Slide {n} ---\n" + ("\n".join(out) if out else "(no text)"))
    text = "\n\n".join(lines)
    return ([DocPart(text=f"Slide deck text (pictures follow, numbered as marked):\n{text}")] if text else []) + pictures


# ------------------------------------------------------------------ prompts
SLIDES_SYSTEM = """\
You are Quark's practice writer. A student has sent their teacher's slides, a PDF
booklet or screenshots of a lesson. Read what the material teaches and write a short
practice set on exactly that content, at the student's grade level.

- `title`: a short name for the practice set. `summary`: one or two sentences on what
  the material covers, in plain words for the student.
- `problems`: 6 to 10 NEW problems (do not copy the examples in the material word for
  word). Order them WARM_UP (1 to 2), then CORE, then STRETCH (1 to 2). Each has the
  `answer` (final answer only, simplified, with units when there are units) and one
  `hint` that points to the first step without giving the answer away.
- Write maths as plain text with ^ for powers, e.g. "3x^2 - 12 = 0".
- Every answer must be correct: solve each problem yourself before writing it.
- If the files hold no maths or science content you can use, set `unreadable` to true
  and leave `problems` empty.
- Never include names of people from the material.
"""

TEXTBOOK_SYSTEM = """\
You are Quark's homework coach. A student has sent textbook pages or screenshots.
Find the numbered problems (at most 12, in page order) and, for each, write hints that
help the student solve it themselves.

- `label`: the problem's number as printed ("4", "4b", "Example 2"). `statement`: the
  problem, copied faithfully (shorten long word problems, keep every number).
- `hints`: 2 to 4 hints, each one more specific than the last. The first names the idea
  or method; the last gets the student to the final step. NEVER give the final answer
  or a full worked solution.
- `check`: one sentence on how the student can check their own answer (substitute back,
  estimate, check units...), without stating the answer.
- Write maths as plain text with ^ for powers.
- If there are no problems you can read, set `unreadable` to true and leave
  `problems` empty.
- Never include names of people from the pages.
"""


def request_text(course_id: str, unit_topic: str, mode: str) -> str:
    what = "slides or booklet" if mode == "SLIDES_DECK" else "textbook pages"
    return (
        f"{curricula.course_context_text(course_id, unit_topic)}\n"
        f"Unit / topic the student gave: {unit_topic}\n"
        f"The {what} follow."
    )


# ------------------------------------------------------------------ engines
class DocumentEngine(Protocol):
    def slides_practice(self, course_id: str, unit_topic: str, parts: Sequence[DocPart]) -> SlidesPracticeOutput: ...

    def textbook_hints(self, course_id: str, unit_topic: str, parts: Sequence[DocPart]) -> TextbookAssistOutput: ...


class GeminiDocumentEngine:
    """Vertex AI Gemini in Montréal, the same region and client setup as grading."""

    def __init__(self, project: Optional[str] = None, client=None):
        from google import genai

        from .pipeline import VERTEX_LOCATION

        self._client = client or genai.Client(
            vertexai=True, project=project or os.environ.get("GOOGLE_CLOUD_PROJECT"), location=VERTEX_LOCATION)

    def _ask(self, system: str, intro: str, parts: Sequence[DocPart], schema, label: str):
        from google.genai import types

        from .batch_engine import WORKSHEET_MODEL, WORKSHEET_THINKING
        from .pipeline import thinking_config, with_retries

        model = DOCUMENT_MODEL or WORKSHEET_MODEL
        contents = [types.Part.from_text(text=intro)]
        for p in parts:
            if p.text is not None:
                contents.append(types.Part.from_text(text=p.text))
            elif p.data is not None:
                contents.append(types.Part.from_bytes(data=p.data, mime_type=p.mime))
            elif p.uri:
                contents.append(types.Part.from_uri(file_uri=p.uri, mime_type=p.mime))
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=schema,
            thinking_config=thinking_config(model, WORKSHEET_THINKING),
        )
        response = with_retries(lambda: self._client.models.generate_content(
            model=model, contents=[types.Content(role="user", parts=contents)], config=config), label)
        return schema.model_validate_json(response.text or "{}")

    def slides_practice(self, course_id, unit_topic, parts):
        return self._ask(SLIDES_SYSTEM, request_text(course_id, unit_topic, "SLIDES_DECK"), parts,
                         SlidesPracticeOutput, "slides_practice")

    def textbook_hints(self, course_id, unit_topic, parts):
        return self._ask(TEXTBOOK_SYSTEM, request_text(course_id, unit_topic, "TEXTBOOK_ASSIST"), parts,
                         TextbookAssistOutput, "textbook_hints")


class FakeDocumentEngine:
    """Deterministic stand-in for local runs and tests. A batch with no parts, or whose
    text says UNREADABLE (e.g. a test deck), comes back unreadable."""

    @staticmethod
    def _blank(parts: Sequence[DocPart]) -> bool:
        return not parts or any("UNREADABLE" in (p.text or "") for p in parts)

    def slides_practice(self, course_id, unit_topic, parts):
        if self._blank(parts):
            return SlidesPracticeOutput(title="", summary="", problems=[], unreadable=True)
        topic = unit_topic or "this lesson"
        return SlidesPracticeOutput(
            title=f"Practice: {topic}",
            summary=f"The slides cover {topic}: solving linear equations by doing the same thing to both sides.",
            problems=[
                SlidesPracticeProblem(number="1", prompt="Solve x + 7 = 12.", answer="x = 5",
                                      hint="Subtract 7 from both sides.", difficulty="WARM_UP"),
                SlidesPracticeProblem(number="2", prompt="Solve 3x - 4 = 11.", answer="x = 5",
                                      hint="Add 4 to both sides first.", difficulty="CORE"),
                SlidesPracticeProblem(number="3", prompt="Solve 2(x + 3) = 5x - 9.", answer="x = 5",
                                      hint="Expand the bracket, then collect the x terms on one side.",
                                      difficulty="STRETCH"),
            ],
        )

    def textbook_hints(self, course_id, unit_topic, parts):
        if self._blank(parts):
            return TextbookAssistOutput(problems=[], unreadable=True)
        return TextbookAssistOutput(problems=[
            TextbookProblemHints(
                label="4", statement="Solve the system x + y = 10 and x - y = 4.",
                hints=["Both equations have a y with opposite signs.",
                       "Add the two equations to eliminate y.",
                       "You get 2x = 14. Solve for x, then substitute back to find y."],
                check="Substitute your x and y into BOTH original equations."),
        ])
