"""Pre-storage PII scrubbing for uploaded photos (spec 3.2).

Every photo goes through ``PhotoScrubber.scrub`` before it is written to storage
or shown to Gemini:

1. EXIF is dropped (phone photos carry GPS location and device ids) and the image
   is turned upright, so "top of the page" means the top the student sees.
2. Edge masking: the header band (top 12% by default, where names, student numbers
   and teacher signatures usually sit) is painted solid black.
3. Deterministic redaction: Cloud DLP finds names, emails and phone numbers
   anywhere else on the page and paints them black. Runs in
   northamerica-northeast1. If DLP fails the upload fails: nothing unscrubbed is
   stored.

Locally and in tests the DLP step is skipped (``NoDlp``); masking still runs.
"""
from __future__ import annotations

import io
import logging
from typing import Optional, Protocol

from PIL import Image, ImageDraw, ImageOps

log = logging.getLogger(__name__)

REGION = "northamerica-northeast1"
DEFAULT_HEADER_FRACTION = 0.12
DLP_INFO_TYPES = ("PERSON_NAME", "FIRST_NAME", "LAST_NAME", "EMAIL_ADDRESS", "PHONE_NUMBER")

_SAVE = {"JPEG": {"quality": 92}, "PNG": {}, "WEBP": {"quality": 92}}


class Redactor(Protocol):
    def redact(self, data: bytes, fmt: str) -> bytes:
        """Return the image with detected PII painted over (same format)."""


class NoDlp:
    def redact(self, data: bytes, fmt: str) -> bytes:
        return data


class CloudDlp:
    def __init__(self, project: str) -> None:
        from google.cloud import dlp_v2

        self._dlp = dlp_v2
        # A regional parent keeps processing in northamerica-northeast1.
        self._client = dlp_v2.DlpServiceClient()
        self._parent = f"projects/{project}/locations/{REGION}"

    def redact(self, data: bytes, fmt: str) -> bytes:
        bt = self._dlp.ByteContentItem.BytesType
        byte_type = {"JPEG": bt.IMAGE_JPEG, "PNG": bt.IMAGE_PNG}.get(fmt, bt.IMAGE)
        info_types = [{"name": n} for n in DLP_INFO_TYPES]
        resp = self._client.redact_image(request={
            "parent": self._parent,
            "inspect_config": {"info_types": info_types, "min_likelihood": "POSSIBLE"},
            "image_redaction_configs": [{"info_type": t, "redaction_color": {"red": 0, "green": 0, "blue": 0}}
                                        for t in info_types],
            "byte_item": {"type_": byte_type, "data": data},
        })
        return resp.redacted_image


class PhotoScrubber:
    def __init__(self, redactor: Optional[Redactor] = None, header_fraction: float = DEFAULT_HEADER_FRACTION):
        if not 0 <= header_fraction < 0.5:
            raise ValueError("header_fraction must be between 0 and 0.5")
        self.redactor = redactor or NoDlp()
        self.header_fraction = header_fraction

    def scrub(self, data: bytes, fmt: str) -> bytes:
        with Image.open(io.BytesIO(data)) as src:
            img = ImageOps.exif_transpose(src)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            band = round(img.height * self.header_fraction)
            if band:
                ImageDraw.Draw(img).rectangle((0, 0, img.width, band), fill=0)
            out = io.BytesIO()
            img.save(out, fmt, **_SAVE.get(fmt, {}))  # fresh encode: no EXIF, no XMP, no GPS
        return self.redactor.redact(out.getvalue(), fmt)
