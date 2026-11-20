"""Straighten and clean up worksheet photos before they are stored and read.

Phone photos are often taken at an angle: the page is a skewed four-sided shape, the
far edge is smaller, and there is desk around it. The reading step does noticeably
worse on those than on a flat, top-down shot of the same page. This module finds the
page's four corners, warps it to a flat rectangle, crops the background and evens
out the lighting, so an angled photo looks close to a straight one.

It is cautious: if it cannot find a clear page outline it returns the photo
unchanged, so a close-up of one question (no page edges visible) is left alone.
"""
from __future__ import annotations

import io
import logging
from typing import Optional

log = logging.getLogger("birdbrains.photo_prep")

# The page outline must cover at least this share of the photo, or we leave it alone
# (a small rectangle is more likely a box drawn on the page than the page itself).
MIN_PAGE_AREA = 0.25
# Below this the page is already straight and filling the frame; warping gains nothing.
MAX_AREA_TO_SKIP = 0.97
# Work on a reduced copy to find the corners (fast), then warp the full-size photo.
DETECT_WIDTH = 1000


def _order_corners(pts):
    """Top-left, top-right, bottom-right, bottom-left."""
    import numpy as np

    pts = np.asarray(pts, dtype="float32").reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], dtype="float32")


def find_page(gray) -> Optional["object"]:
    """The page's four corners in ``gray`` (a 2D uint8 array), or None."""
    import cv2
    import numpy as np

    h, w = gray.shape
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Paper is the brightest large region: threshold it, close the handwriting holes,
    # and take the largest outline. Fall back to edges when lighting is uneven.
    candidates = []
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    candidates.append(mask)
    edges = cv2.Canny(blurred, 50, 150)
    candidates.append(cv2.dilate(edges, np.ones((5, 5), np.uint8)))
    for img in candidates:
        contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
            area = cv2.contourArea(c)
            if area < MIN_PAGE_AREA * w * h:
                break
            hull = cv2.convexHull(c)
            peri = cv2.arcLength(hull, True)
            for eps in (0.02, 0.03, 0.05):
                approx = cv2.approxPolyDP(hull, eps * peri, True)
                if len(approx) == 4:
                    return _order_corners(approx)
    return None


def _target_size(corners) -> tuple[int, int]:
    import numpy as np

    tl, tr, br, bl = corners
    width = max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl))
    height = max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl))
    return int(round(width)), int(round(height))


def straighten(data: bytes, fmt: str) -> bytes:
    """Return the photo flattened, cropped to the page and with even lighting, encoded
    in the same format. On any doubt or error, return ``data`` unchanged."""
    try:
        import cv2
        import numpy as np
    except ImportError:  # local runs without opencv: skip, never fail an upload
        return data
    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(data)) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            rgb = np.array(im)
        h, w = rgb.shape[:2]
        scale = DETECT_WIDTH / max(w, h) if max(w, h) > DETECT_WIDTH else 1.0
        small = cv2.resize(rgb, (int(w * scale), int(h * scale))) if scale < 1 else rgb
        corners = find_page(cv2.cvtColor(small, cv2.COLOR_RGB2GRAY))
        if corners is None:
            return data
        corners = corners / scale
        quad_area = cv2.contourArea(corners.reshape(-1, 1, 2))
        if quad_area > MAX_AREA_TO_SKIP * w * h:
            return data
        tw, th = _target_size(corners)
        # Never shrink below the upload's resolution floor because of the warp.
        grow = max(1.0, 1080 / max(1, min(tw, th)))
        tw, th = int(tw * grow), int(th * grow)
        dst = np.array([[0, 0], [tw - 1, 0], [tw - 1, th - 1], [0, th - 1]], dtype="float32")
        matrix = cv2.getPerspectiveTransform(corners.astype("float32"), dst)
        flat = cv2.warpPerspective(rgb, matrix, (tw, th), flags=cv2.INTER_CUBIC,
                                   borderMode=cv2.BORDER_REPLICATE)
        flat = even_lighting(flat)
        out = io.BytesIO()
        Image.fromarray(flat).save(out, format=fmt.upper() if fmt.upper() != "JPG" else "JPEG",
                                   **({"quality": 92} if fmt.upper() in ("JPEG", "JPG") else {}))
        return out.getvalue()
    except Exception:
        log.exception("Photo straightening failed; keeping the original")
        return data


def even_lighting(rgb):
    """Flatten shadows and boost local contrast on the lightness channel only, so ink
    stays its colour and faint pencil gets darker against the paper."""
    import cv2

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)
