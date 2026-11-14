"""Pre-storage PII scrubbing for uploaded photos (spec 3.2, as changed by Maalik
on 2026-11-13: find the name / date / class fields and blur them, rather than
blacking out a fixed strip).

Every photo goes through ``PhotoScrubber.scrub`` before it is written to storage
or shown to Gemini:

1. EXIF is dropped (phone photos carry GPS location and device ids) and the image
   is turned upright.
2. Detection: Cloud DLP reads the page (in northamerica-northeast1) and reports
   - printed header labels such as "Name:", "Date:", "Class", "Period",
     "Teacher", "Student #". Whatever is written after the label, on that line,
     is treated as private: the box runs from the label to the right edge.
   - names, dates, emails and phone numbers anywhere on the page.
3. Every detected box is padded and heavily blurred (Gaussian blur over a
   pixelated copy, so handwriting cannot be recovered).
If DLP fails the upload fails: nothing unscrubbed is stored.

``BIRDBRAINS_HEADER_MASK`` can still black out a fixed top strip as a backstop
(off by default). Locally and in tests there is no DLP, so nothing is detected
unless a test supplies a detector.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional, Protocol

from PIL import Image, ImageDraw, ImageFilter, ImageOps

log = logging.getLogger(__name__)

REGION = "northamerica-northeast1"
LABEL = "HEADER_FIELD_LABEL"
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
        boxes = self.detector.detect(self._encode(img, fmt), fmt)  # coordinates match the upright image
        for region in _regions(boxes, img.width, img.height):
            blur_region(img, region)
        band = round(img.height * self.header_fraction)
        if band:
            ImageDraw.Draw(img).rectangle((0, 0, img.width, band), fill=0)
        if boxes:
            log.info("Blurred %d private regions (%s)", len(boxes), sorted({b.kind for b in boxes}))
        return self._encode(img, fmt)
