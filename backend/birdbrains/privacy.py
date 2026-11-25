"""Pre-storage PII scrubbing for uploaded photos (spec 3.2, as changed by Maalik
on 2026-11-13: find the name / date / class fields and blur them, rather than
blacking out a fixed strip).

Every photo goes through ``PhotoScrubber.scrub`` before it is written to storage
or shown to Gemini:

1. EXIF is dropped (phone photos carry GPS location and device ids) and the image
   is turned upright.
2. Detection: Gemini in northamerica-northeast1 reads the page (Cloud DLP's image
   inspection, used before, is not offered there; BIRDBRAINS_PRIVACY_DETECTOR=dlp still
   selects it) and reports
   - printed header labels such as "Name:", "Date:", "Class", "Period",
     "Teacher", "Student #". Whatever is written after the label, on that line,
     is treated as private: the box runs from the label to the right edge.
   - names, dates, emails and phone numbers anywhere on the page.
3. Every detected box is padded and heavily blurred (Gaussian blur over a
   pixelated copy, so handwriting cannot be recovered).
If detection fails, the upload still goes through (Maalik, 2026-11-18: a failed name check must
not block a student). The top FALLBACK_HEADER_FRACTION of the page, where names and dates
are written, is blurred instead, EXIF is still dropped, and a ``privacy_fallback`` log line
records Google's error so the cause can be fixed. Names elsewhere on the page are not
caught in that case, and Stage 1 is told never to transcribe names.

``BIRDBRAINS_HEADER_MASK`` can still black out a fixed top strip as a backstop
(off by default). Locally and in tests there is no DLP, so nothing is detected
unless a test supplies a detector.
"""
from __future__ import annotations

import io
import json
import logging
import os
from dataclasses import dataclass
from typing import Optional, Protocol

from PIL import Image, ImageDraw, ImageFilter, ImageOps

log = logging.getLogger(__name__)

REGION = "northamerica-northeast1"
LABEL = "HEADER_FIELD_LABEL"
FALLBACK_HEADER_FRACTION = 0.15  # blurred when Cloud DLP is unavailable
# Printed labels on worksheets and tests. The value written after them is private.
LABEL_REGEX = (
    r"(?i)\b(name|nom|first name|last name|date|class|classe|period|block|section|teacher|"
    r"enseignant|student\s*(?:no|number|#|id)|homeroom|school|[ée]cole)\b"
)
DLP_INFO_TYPES = ("PERSON_NAME", "FIRST_NAME", "LAST_NAME", "DATE", "EMAIL_ADDRESS", "PHONE_NUMBER")

_SAVE = {"JPEG": {"quality": 92}, "PNG": {}, "WEBP": {"quality": 92}}


@dataclass
class Box:
    kind: str  # LABEL, or the DLP info type
    left: int
    top: int
    width: int
    height: int


class Detector(Protocol):
    def detect(self, data: bytes, fmt: str) -> list[Box]:
        """Boxes of private text on the image, in pixels."""


class NoDetector:
    def detect(self, data: bytes, fmt: str) -> list[Box]:
        return []


class CloudDlpDetector:
    def __init__(self, project: str) -> None:
        from google.cloud import dlp_v2

        self._dlp = dlp_v2
        self._client = dlp_v2.DlpServiceClient()
        self._parent = f"projects/{project}/locations/{REGION}"  # processed in Montréal

    def detect(self, data: bytes, fmt: str) -> list[Box]:
        bt = self._dlp.ByteContentItem.BytesType
        byte_type = {"JPEG": bt.IMAGE_JPEG, "PNG": bt.IMAGE_PNG}.get(fmt, bt.IMAGE)
        resp = self._client.inspect_content(request={
            "parent": self._parent,
            "inspect_config": {
                "info_types": [{"name": n} for n in DLP_INFO_TYPES],
                "custom_info_types": [{"info_type": {"name": LABEL}, "regex": {"pattern": LABEL_REGEX}}],
                "min_likelihood": "POSSIBLE",
                "include_quote": False,  # we never want the private text back
                "limits": {"max_findings_per_request": 0},
            },
            "item": {"byte_item": {"type_": byte_type, "data": data}},
        })
        boxes = []
        for f in resp.result.findings:
            for loc in f.location.content_locations:
                for b in loc.image_location.bounding_boxes:
                    boxes.append(Box(f.info_type.name, b.left, b.top, b.width, b.height))
        return boxes


GEMINI_PRIVACY_PROMPT = """\
This is a photo of a student's maths work. Find every piece of personal information on
it so it can be blurred before the photo is stored:
- names of any person (student, teacher, parent), handwritten or printed;
- dates, email addresses, phone numbers, student or ID numbers;
- whatever is written after a header label such as Name, Nom, Date, Class, Period, Block,
  Teacher, Student #, Homeroom or School (kind HEADER_VALUE; box the written value).
Do not return mathematics, question text or printed instructions. Return each item's
box_2d as [ymin, xmin, ymax, xmax], scaled 0 to 1000 over the whole image. Return an
empty list when there is nothing personal on the page."""

_GEMINI_KINDS = ["PERSON_NAME", "DATE", "EMAIL_ADDRESS", "PHONE_NUMBER", "ID_NUMBER", "HEADER_VALUE"]
_GEMINI_SCHEMA = {
    "type": "object",
    "properties": {"items": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "kind": {"type": "string", "enum": _GEMINI_KINDS},
            "box_2d": {"type": "array", "items": {"type": "integer"}, "minItems": 4, "maxItems": 4},
        },
        "required": ["kind", "box_2d"],
    }}},
    "required": ["items"],
}


def boxes_from_gemini(items: list[dict], width: int, height: int) -> list[Box]:
    """Gemini's [ymin, xmin, ymax, xmax] on a 0-1000 grid, to pixel boxes. A header value
    is treated like a DLP label hit: blurred to the right edge of its line."""
    out = []
    for item in items:
        try:
            y0, x0, y1, x1 = (max(0, min(1000, int(v))) for v in item["box_2d"])
        except (KeyError, TypeError, ValueError):
            continue
        if y1 <= y0 or x1 <= x0:
            continue
        kind = LABEL if item.get("kind") == "HEADER_VALUE" else str(item.get("kind", "PERSON_NAME"))
        left, top = round(x0 * width / 1000), round(y0 * height / 1000)
        out.append(Box(kind, left, top, max(1, round(x1 * width / 1000) - left), max(1, round(y1 * height / 1000) - top)))
    return out


class GeminiPrivateTextDetector:
    """Finds names, dates and header values with Gemini in Montréal. Cloud DLP's image
    inspection is not offered in northamerica-northeast1 (every upload fell back to the
    header blur, seen in the live logs on 2026-11-25), and the photo must stay in Canada.
    The same image goes to the same Gemini endpoint for grading, so nothing new leaves."""

    def __init__(self, project: str, client=None) -> None:
        from .pipeline import STAGE1_MODEL, VERTEX_LOCATION

        self._model = os.environ.get("BIRDBRAINS_PRIVACY_MODEL", STAGE1_MODEL)
        if client is None:
            from google import genai

            client = genai.Client(vertexai=True, project=project, location=VERTEX_LOCATION)
        self._client = client

    def detect(self, data: bytes, fmt: str) -> list[Box]:
        from google.genai import types

        from .pipeline import thinking_config, with_retries

        with Image.open(io.BytesIO(data)) as img:
            width, height = img.size
        mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(fmt, "image/jpeg")
        config = types.GenerateContentConfig(
            temperature=0.0,
            thinking_config=thinking_config(self._model, "MINIMAL"),
            response_mime_type="application/json",
            response_json_schema=_GEMINI_SCHEMA,
        )
        contents = [types.Part.from_bytes(data=data, mime_type=mime), GEMINI_PRIVACY_PROMPT]
        response = with_retries(lambda: self._client.models.generate_content(
            model=self._model, contents=contents, config=config), "privacy")
        items = json.loads(response.text or "{}").get("items", [])
        return boxes_from_gemini(items, width, height)


def make_detector(project: str) -> Detector:
    """BIRDBRAINS_PRIVACY_DETECTOR: gemini (default) or dlp (Cloud DLP, where its image
    inspection is offered)."""
    if os.environ.get("BIRDBRAINS_PRIVACY_DETECTOR", "gemini") == "dlp":
        return CloudDlpDetector(project)
    return GeminiPrivateTextDetector(project)


def _regions(boxes: list[Box], width: int, height: int) -> list[tuple[int, int, int, int]]:
    out = []
    for b in boxes:
        pad = max(6, b.height // 2)
        top, bottom = max(0, b.top - pad), min(height, b.top + b.height + pad)
        left = max(0, b.left - pad)
        # A label's value is written after it on the same line: blur to the right edge.
        right = width if b.kind == LABEL else min(width, b.left + b.width + pad)
        out.append((left, top, right, bottom))
    return out


def blur_region(img: Image.Image, region: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = region
    if right <= left or bottom <= top:
        return
    patch = img.crop(region)
    w, h = patch.size
    block = max(8, h // 4)
    small = patch.resize((max(1, w // block), max(1, h // block)), Image.Resampling.BILINEAR)
    patch = small.resize((w, h), Image.Resampling.NEAREST).filter(ImageFilter.GaussianBlur(max(6, h // 3)))
    img.paste(patch, region[:2])


class PhotoScrubber:
    def __init__(self, detector: Optional[Detector] = None, header_fraction: float = 0.0):
        if not 0 <= header_fraction < 0.5:
            raise ValueError("header_fraction must be between 0 and 0.5")
        self.detector = detector or NoDetector()
        self.header_fraction = header_fraction

    def _encode(self, img: Image.Image, fmt: str) -> bytes:
        out = io.BytesIO()
        img.save(out, fmt, **_SAVE.get(fmt, {}))  # fresh encode: no EXIF, no XMP, no GPS
        return out.getvalue()

    def scrub(self, data: bytes, fmt: str) -> bytes:
        with Image.open(io.BytesIO(data)) as src:
            img = ImageOps.exif_transpose(src)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.load()
        try:
            boxes = self.detector.detect(self._encode(img, fmt), fmt)  # coordinates match the upright image
        except Exception as exc:  # DLP down, not enabled, no permission, timeout...
            boxes = []
            blur_region(img, (0, 0, img.width, round(img.height * FALLBACK_HEADER_FRACTION)))
            print(json.dumps({"severity": "WARNING", "event": "privacy_fallback", "error": type(exc).__name__,
                              "message": str(exc)[:300]}), flush=True)
        for region in _regions(boxes, img.width, img.height):
            blur_region(img, region)
        band = round(img.height * self.header_fraction)
        if band:
            ImageDraw.Draw(img).rectangle((0, 0, img.width, band), fill=0)
        if boxes:
            log.info("Blurred %d private regions (%s)", len(boxes), sorted({b.kind for b in boxes}))
        return self._encode(img, fmt)
