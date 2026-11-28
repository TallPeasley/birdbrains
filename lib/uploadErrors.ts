// Upload failure codes. Mirrors backend/birdbrains/upload_errors.py (a backend test keeps the code list in step).
// 1xx photo, 2xx reading the page, 3xx privacy and storage, 4xx account and plan, 5xx our grading service, 9xx other.

export interface UploadErrorInfo {
  title: string;
  message: string;
  action: string;
  /** A better photo fixes it. */
  retake: boolean;
  /** It is on us, not on the photo or the account. */
  ours: boolean;
}

export const UPLOAD_ERRORS: Record<number, UploadErrorInfo> = {
  101: {
    title: "Photo too blurry",
    message: "The photo is too blurry to read.",
    action: "Hold the phone steady, tap to focus, and retake it.",
    retake: true,
    ours: false,
  },
  102: {
    title: "Photo too small",
    message: "The photo is below the minimum size (1080p).",
    action: "Retake it closer or at a higher quality setting.",
    retake: true,
    ours: false,
  },
  104: {
    title: "File can't be opened",
    message: "One of the files is not a readable image.",
    action: "Pick the photo again, or take a new one.",
    retake: true,
    ours: false,
  },
  105: {
    title: "Wrong file type",
    message: "Photos must be JPEG, PNG or WebP.",
    action: "Use the camera photo, not a PDF or screenshot of another format.",
    retake: true,
    ours: false,
  },
  106: {
    title: "File too large",
    message: "Each photo must be 12 MB or smaller.",
    action: "Lower the camera quality a little and try again.",
    retake: true,
    ours: false,
  },
  107: {
    title: "Wrong number of photos",
    message: "Attach between 1 and 6 photos.",
    action: "Add at least one photo, or split a long set into two uploads.",
    retake: false,
    ours: false,
  },
  108: {
    title: "Already uploaded",
    message: "This exact photo was uploaded before.",
    action: "Open your earlier diagnostic, or upload a different page.",
    retake: false,
    ours: false,
  },
  109: {
    title: "Subject not graded yet",
    message: "Quark grades math work today. Grading for this subject is not available yet.",
    action: "Upload a math page, or pick a math course in your account settings.",
    retake: false,
    ours: false,
  },
  201: {
    title: "Handwriting unclear",
    message: "We couldn't read the handwriting clearly enough.",
    action: "Retake in good light, flat on a desk, with the whole page in view.",
    retake: true,
    ours: false,
  },
  202: {
    title: "Blank page",
    message: "The page looks empty, with no student work on it.",
    action: "Check you picked the right page and retake it.",
    retake: true,
    ours: false,
  },
  203: {
    title: "Not a maths page",
    message: "This doesn't look like maths work.",
    action: "Upload the maths page, with the working shown.",
    retake: true,
    ours: false,
  },
  204: {
    title: "Questions not visible",
    message: "We can see the answers but not the questions they belong to.",
    action: "Include the printed questions in the photo, then retake.",
    retake: true,
    ours: false,
  },
  205: {
    title: "Page cut off",
    message: "Part of the page is outside the photo.",
    action: "Retake with all four corners of the page in view.",
    retake: true,
    ours: false,
  },
  206: {
    title: "Glare or shadow",
    message: "Glare or a shadow is covering some of the work.",
    action: "Move the page out of direct light, avoid your own shadow, and retake.",
    retake: true,
    ours: false,
  },
  301: {
    title: "Name check skipped",
    message: "The name check could not run, so the top of the page was blurred instead.",
    action: "Nothing to do. The upload went ahead.",
    retake: false,
    ours: true,
  },
  302: {
    title: "Photo not saved",
    message: "We could not save the photo.",
    action: "Please try again in a minute.",
    retake: false,
    ours: true,
  },
  303: {
    title: "Photo expired",
    message: "Photos are deleted after 90 days.",
    action: "The diagnostic is still there. Upload the page again if you need the photo.",
    retake: false,
    ours: false,
  },
  304: {
    title: "Upload link expired",
    message: "The upload link only works once, for 15 minutes.",
    action: "Start the upload again from the extension, or make a new QR code.",
    retake: false,
    ours: false,
  },
  305: {
    title: "Phone link already used",
    message: "Photos were already sent with this QR code.",
    action: "Make a new QR code on your computer to send more.",
    retake: false,
    ours: false,
  },
  401: {
    title: "Signed out",
    message: "You need to sign in again.",
    action: "Sign in and retry.",
    retake: false,
    ours: false,
  },
  402: {
    title: "Free limit reached",
    message: "All Free uploads for this month are used.",
    action: "The allowance resets on the 1st, or upgrade to Pro.",
    retake: false,
    ours: false,
  },
  403: {
    title: "Not allowed",
    message: "This account can't upload for that student.",
    action: "Switch to the right student or account.",
    retake: false,
    ours: false,
  },
  404: {
    title: "Finish account setup",
    message: "The account setup isn't finished.",
    action: "Complete your profile, then upload.",
    retake: false,
    ours: false,
  },
  405: {
    title: "Pro feature",
    message: "That feature needs a Pro plan.",
    action: "Upgrade to Pro to use it.",
    retake: false,
    ours: false,
  },
  501: {
    title: "Grading service unavailable",
    message: "Our grading service isn't available right now.",
    action: "Try again later. We have been told.",
    retake: false,
    ours: true,
  },
  502: {
    title: "Grading service busy",
    message: "Lots of people are uploading right now.",
    action: "Wait a minute and press Try again.",
    retake: false,
    ours: true,
  },
  503: {
    title: "Grading took too long",
    message: "Grading took longer than expected.",
    action: "Press Try again. Your photo is saved.",
    retake: false,
    ours: true,
  },
  504: {
    title: "Result not understood",
    message: "We got a result back that we couldn't use.",
    action: "Press Try again. If it repeats, tell us the code.",
    retake: false,
    ours: true,
  },
  505: {
    title: "Grading failed",
    message: "Something unexpected stopped the grading.",
    action: "Press Try again. If it repeats, tell us the code.",
    retake: false,
    ours: true,
  },
  900: {
    title: "Something went wrong",
    message: "Something unexpected happened.",
    action: "Try again. If it repeats, tell us the code.",
    retake: false,
    ours: false,
  },
  901: {
    title: "Can't reach Quark",
    message: "We couldn't reach Quark.",
    action: "Check your internet connection and try again.",
    retake: false,
    ours: false,
  },
};

/** The code to show for a failure, from the API body or, failing that, the HTTP status and detail. */
export function uploadErrorCode(status: number, detail: string, code?: number): number {
  if (code && UPLOAD_ERRORS[code]) return code;
  if (status === 0) return 901;
  if (status === 401) return 401;
  if (detail === 'FREE_LIMIT_REACHED') return 402;
  if (detail === 'PROFILE_REQUIRED') return 404;
  if (detail === 'PRO_ONLY') return 405;
  if (status === 403 || status === 404) return 403;
  return 900;
}
