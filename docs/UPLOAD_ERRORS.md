# Upload failure codes

Why an upload did not become a diagnostic. These are different from the four-pillar error codes (CON-01, PRC-03...), which describe a student's maths mistakes.

Source of truth: `backend/birdbrains/upload_errors.py`. `lib/uploadErrors.ts` mirrors it and a backend test checks the code lists match. Every failed upload response carries `code`, `title`, `action`, `retake` and `ours` next to the old `detail`.

**Retake** means a better photo fixes it. **Ours** means the fault is ours, not the photo or account.


## 1xx Photo quality (checked as it arrives)

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 101 | Photo too blurry | The photo is too blurry to read. | Hold the phone steady, tap to focus, and retake it. | yes |  |
| 102 | Photo too small | The photo is below the minimum size (1080p). | Retake it closer or at a higher quality setting. | yes |  |
| 104 | File can't be opened | One of the files is not a readable image. | Pick the photo again, or take a new one. | yes |  |
| 105 | Wrong file type | Photos must be JPEG, PNG or WebP. | Use the camera photo, not a PDF or screenshot of another format. | yes |  |
| 106 | File too large | Each photo must be 12 MB or smaller. | Lower the camera quality a little and try again. | yes |  |
| 107 | Wrong number of photos | Attach between 1 and 6 photos. | Add at least one photo, or split a long set into two uploads. |  |  |
| 108 | Already uploaded | This exact photo was uploaded before. | Open your earlier diagnostic, or upload a different page. |  |  |

## 2xx Reading the page (after upload)

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 201 | Handwriting unclear | We couldn't read the handwriting clearly enough. | Retake in good light, flat on a desk, with the whole page in view. | yes |  |
| 202 | Blank page | The page looks empty, with no student work on it. | Check you picked the right page and retake it. | yes |  |
| 203 | Not a maths page | This doesn't look like maths work. | Upload the maths page, with the working shown. | yes |  |
| 204 | Questions not visible | We can see the answers but not the questions they belong to. | Include the printed questions in the photo, then retake. | yes |  |
| 205 | Page cut off | Part of the page is outside the photo. | Retake with all four corners of the page in view. | yes |  |
| 206 | Glare or shadow | Glare or a shadow is covering some of the work. | Move the page out of direct light, avoid your own shadow, and retake. | yes |  |

## 3xx Privacy check and storage

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 301 | Name check skipped | The name check could not run, so the top of the page was blurred instead. | Nothing to do. The upload went ahead. |  | yes |
| 302 | Photo not saved | We could not save the photo. | Please try again in a minute. |  | yes |
| 303 | Photo expired | Photos are deleted after 90 days. | The diagnostic is still there. Upload the page again if you need the photo. |  |  |
| 304 | Upload link expired | The upload link only works once, for 15 minutes. | Start the upload again from the extension, or make a new QR code. |  |  |
| 305 | Phone link already used | Photos were already sent with this QR code. | Make a new QR code on your computer to send more. |  |  |

## 4xx Account and plan

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 401 | Signed out | You need to sign in again. | Sign in and retry. |  |  |
| 402 | Free limit reached | All Free uploads for this month are used. | The allowance resets on the 1st, or upgrade to Pro. |  |  |
| 403 | Not allowed | This account can't upload for that student. | Switch to the right student or account. |  |  |
| 404 | Finish account setup | The account setup isn't finished. | Complete your profile, then upload. |  |  |
| 405 | Pro feature | That feature needs a Pro plan. | Upgrade to Pro to use it. |  |  |

## 5xx Our grading service

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 501 | Grading service unavailable | Our grading service isn't available right now. | Try again later. We have been told. |  | yes |
| 502 | Grading service busy | Lots of people are uploading right now. | Wait a minute and press Try again. |  | yes |
| 503 | Grading took too long | Grading took longer than expected. | Press Try again. Your photo is saved. |  | yes |
| 504 | Result not understood | We got a result back that we couldn't use. | Press Try again. If it repeats, tell us the code. |  | yes |
| 505 | Grading failed | Something unexpected stopped the grading. | Press Try again. If it repeats, tell us the code. |  | yes |

## 9xx Other

| Code | Title | What the student sees | What to do | Retake | Ours |
|---|---|---|---|---|---|
| 900 | Something went wrong | Something unexpected happened. | Try again. If it repeats, tell us the code. |  |  |
| 901 | Can't reach BirdBrains | We couldn't reach BirdBrains. | Check your internet connection and try again. |  |  |

## Where each comes from

- 101, 102 (also checked in the browser), 104 to 108, 302, 304, 305: upload (`POST /submissions`, extension link, phone QR link).
- 201 to 206: the reading step. Stage 1 sets `unreadable_reason`; 201 is used when it gives none (low confidence).
- 303: photo fetch after 90 days. 402: Free limit, also on the extension ticket.
- 501 to 505: the grading call. 404, 403 or a region problem from Google is 501, rate limits and Google outages 502, timeouts 503, an unusable result 504, anything else 505.
- 401, 403, 404, 405, 900, 901: shown by the site from the HTTP status when the API sent no code.
- 301 is informational: the name check failed and the top of the page was blurred instead. It is not shown as an error.
