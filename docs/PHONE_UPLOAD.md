# Phone camera upload (QR codes)

Every upload spot on a computer shows a QR code. Scanning it opens `/phone` on the phone,
where the student takes the photo with the phone's camera. The result shows up on the computer.

Where the QR code appears:

- The upload window (`components/CaptureModal.tsx`), however it was opened: dashboard
  "Upload new work", parent "Upload work", the "Upload my work" buttons beside worksheet
  problems, the home-screen shortcut.
- "Something read wrong? > Use my phone" on the student dashboard, which adds photos to the
  upload on screen instead of starting a new one.

It is shown on computers only (not on phones or tablets, which have a Take photo button) and only
on the live site when signed in.

## How the link is kept safe

1. The signed-in computer calls `POST /phone-uploads` with what the photo is for:
   `{kind: "new", studentId, worksheetGradingId?, problem?}` or `{kind: "addPhotos", submissionId}`.
   The API checks the account may upload for that student (or owns that upload) and the Free
   allowance, then returns `{sessionId, token}`. Only a SHA-256 hash of the token is stored
   (Firestore collection `phoneuploads`).
2. The QR code holds `https://<site>/phone?s=<sessionId>#t=<token>`. The token is after `#`, so it
   never reaches the web host. The phone page keeps it in sessionStorage and removes it from the
   address bar.
3. The phone sends it as the `X-Upload-Token` header: `GET /phone/{id}` returns only what the link is
   for (the problem text) and its state, never names or results. `POST /phone/{id}/photos` sends the
   photos; they go through the same checks as any upload (size, blur, duplicate, name blurring,
   monthly allowance) and are read and graded in that request.
4. The link works for 15 minutes and one upload. A photo that fails the checks, or a page that can't
   be read, leaves it open for another try. Closing the upload window on the computer turns it off
   (`DELETE /phone-uploads/{id}`).
5. The computer polls `GET /phone-uploads/{id}` (owner only) every 2 seconds and follows the
   submission through the usual progress steps.

Uploads from a phone have `source: "phone"`. Uploads started from a worksheet problem (from the
computer or a phone) store `forWorksheet: {gradingId, problem}` on the submission.

Error 305 means the code was already used; 304 that it ran out or was turned off.
