"""Upload failure codes: why a photo did not become a diagnostic.

These are separate from the four-pillar error codes (CON-01, PRC-03...), which describe
a student's maths mistakes. These describe a failed upload, in five series:

  1xx  the photo itself, checked as it arrives
  2xx  reading the page, after upload
  3xx  privacy check and storage
  4xx  account and plan
  5xx  our grading service
  9xx  anything else

Every API failure on the upload path carries one of these in the response body as
``code`` next to the old ``detail`` string. The frontend shows the code, a plain title
and what to do next (lib/uploadErrors.ts mirrors this table; a test keeps them in step).
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from fastapi import HTTPException


@dataclass(frozen=True)
class UploadErrorInfo:
    code: int
    title: str
    message: str   # what the student or parent reads
    action: str    # what to do next
    retake: bool   # True: a better photo fixes it
    ours: bool = False  # True: it is on us, not on the photo or the account


def _e(code, title, message, action, retake=False, ours=False):
    return code, UploadErrorInfo(code, title, message, action, retake, ours)


UPLOAD_ERRORS: dict[int, UploadErrorInfo] = dict([
    # 1xx: the photo, checked as it arrives
    _e(101, "Photo too blurry", "The photo is too blurry to read.", "Hold the phone steady, tap to focus, and retake it.", True),
    _e(102, "Photo too small", "The photo is below the minimum size (1080p).", "Retake it closer or at a higher quality setting.", True),
    _e(104, "File can't be opened", "One of the files is not a readable image.", "Pick the photo again, or take a new one.", True),
    _e(105, "Wrong file type", "Photos must be JPEG, PNG or WebP.", "Use the camera photo, not a PDF or screenshot of another format.", True),
    _e(106, "File too large", "Each photo must be 12 MB or smaller.", "Lower the camera quality a little and try again.", True),
    _e(107, "Wrong number of photos", "Attach between 1 and 6 photos.", "Add at least one photo, or split a long set into two uploads."),
    _e(108, "Already uploaded", "This exact photo was uploaded before.", "Open your earlier diagnostic, or upload a different page."),
    # 2xx: reading the page
    _e(201, "Handwriting unclear", "We couldn't read the handwriting clearly enough.", "Retake in good light, flat on a desk, with the whole page in view.", True),
    _e(202, "Blank page", "The page looks empty, with no student work on it.", "Check you picked the right page and retake it.", True),
    _e(203, "Not a maths page", "This doesn't look like maths work.", "Upload the maths page, with the working shown.", True),
    _e(204, "Questions not visible", "We can see the answers but not the questions they belong to.", "Include the printed questions in the photo, then retake.", True),
    _e(205, "Page cut off", "Part of the page is outside the photo.", "Retake with all four corners of the page in view.", True),
    _e(206, "Glare or shadow", "Glare or a shadow is covering some of the work.", "Move the page out of direct light, avoid your own shadow, and retake.", True),
    # 3xx: privacy check and storage
    _e(301, "Name check skipped", "The name check could not run, so the top of the page was blurred instead.", "Nothing to do. The upload went ahead.", False, True),
    _e(302, "Photo not saved", "We could not save the photo.", "Please try again in a minute.", False, True),
    _e(303, "Photo expired", "Photos are deleted after 90 days.", "The diagnostic is still there. Upload the page again if you need the photo.", False),
    _e(304, "Upload link expired", "The upload link only works once, for 15 minutes.", "Start the upload again from the extension, or make a new QR code.", False),
    _e(305, "Phone link already used", "Photos were already sent with this QR code.", "Make a new QR code on your computer to send more.", False),
    # 4xx: account and plan
    _e(401, "Signed out", "You need to sign in again.", "Sign in and retry."),
    _e(402, "Free limit reached", "All Free uploads for this month are used.", "The allowance resets on the 1st, or upgrade to Pro."),
    _e(403, "Not allowed", "This account can't upload for that student.", "Switch to the right student or account."),
    _e(404, "Finish account setup", "The account setup isn't finished.", "Complete your profile, then upload."),
    _e(405, "Pro feature", "That feature needs a Pro plan.", "Upgrade to Pro to use it."),
    # 5xx: our grading service
    _e(501, "Grading service unavailable", "Our grading service isn't available right now.", "Try again later. We have been told.", False, True),
    _e(502, "Grading service busy", "Lots of people are uploading right now.", "Wait a minute and press Try again.", False, True),
    _e(503, "Grading took too long", "Grading took longer than expected.", "Press Try again. Your photo is saved.", False, True),
    _e(504, "Result not understood", "We got a result back that we couldn't use.", "Press Try again. If it repeats, tell us the code.", False, True),
    _e(505, "Grading failed", "Something unexpected stopped the grading.", "Press Try again. If it repeats, tell us the code.", False, True),
    # 9xx: anything else
    _e(900, "Something went wrong", "Something unexpected happened.", "Try again. If it repeats, tell us the code."),
    _e(901, "Can't reach Quark", "We couldn't reach Quark.", "Check your internet connection and try again."),
])

# Stage 1 says why a page was unreadable; this turns it into a code.
READING_REASON_CODES = {
    "HANDWRITING_UNCLEAR": 201,
    "BLANK_PAGE": 202,
    "NOT_MATH": 203,
    "QUESTIONS_NOT_VISIBLE": 204,
    "PAGE_CUT_OFF": 205,
    "GLARE_OR_SHADOW": 206,
}


class UploadFailure(HTTPException):
    """An HTTP error that also carries an upload failure code."""

    def __init__(self, status_code: int, code: int, detail: str | None = None, headers: dict | None = None):
        self.code = code
        super().__init__(status_code, detail or UPLOAD_ERRORS[code].message, headers=headers)


def failure_body(exc: UploadFailure) -> dict:
    info = UPLOAD_ERRORS[exc.code]
    return {"detail": exc.detail, "code": info.code, "title": info.title, "action": info.action,
            "retake": info.retake, "ours": info.ours}


def classify_pipeline_error(exc: BaseException) -> int:
    """Map whatever the grading call raised to a 5xx code. Never returns text from the error."""
    name = type(exc).__name__
    status = getattr(exc, "code", None)
    if isinstance(status, int):
        if status in (404, 403, 401) or (status == 400 and "FAILED_PRECONDITION" in str(exc)):
            return 501  # model not found, no permission, or not served in this region
        if status in (429, 500, 502, 503):
            return 502  # busy or Google-side trouble
        if status in (408, 504):
            return 503
    if isinstance(exc, TimeoutError) or "Timeout" in name or "DeadlineExceeded" in name:
        return 503
    if name in ("ValidationError", "JSONDecodeError") or isinstance(exc, (json.JSONDecodeError, ValueError)):
        return 504
    return 505
