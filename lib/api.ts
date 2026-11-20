import type {
  ApiClass,
  ClassroomCourse,
  ClassroomCoursework,
  ClassroomImportResult,
  LmsProviderId,
  LmsProviderStatus,
  LmsSyncResult,
  PlanTier,
  RosterStudent,
  ProgressReport,
  CohortReport,
  ApiUploadTicket,
  ApiUsage,
  ParentProjectionSummary,
  Stage2GradingAndAffectOutput,
  SubmissionIngestionPayload,
  UserProfile,
  WS_3STAGE_V1,
} from '@/types/birdBrains';

/** Base URL of the BirdBrains API. When unset the app runs on demo data only. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const IS_LIVE = API_URL !== '';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    /** Upload failure code (see lib/uploadErrors.ts), when the API sent one. */
    public code?: number,
  ) {
    super(detail);
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, 'Could not reach BirdBrains. Check your connection and try again.');
  }
  if (!res.ok) {
    let detail = res.statusText;
    let code: number | undefined;
    try {
      const body = await res.json();
      if (typeof body.code === 'number') code = body.code;
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = 'Some of the details entered are not valid.';
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export interface ProcessResult {
  submission: SubmissionIngestionPayload;
  grading: Stage2GradingAndAffectOutput | null;
}

export const api = {
  me: (t: string) => request<UserProfile>('/me', t),
  register: (t: string, body: { role: 'student' | 'parent' | 'teacher'; name: string; course?: string }) =>
    request<UserProfile>('/me', t, json(body)),
  linkChild: (t: string, linkCode: string) => request<UserProfile>('/me/children', t, json({ linkCode })),
  createSubmission: (t: string, form: FormData) =>
    request<SubmissionIngestionPayload>('/submissions', t, { method: 'POST', body: form }),
  getSubmission: (t: string, id: string) => request<SubmissionIngestionPayload>(`/submissions/${id}`, t),
  processSubmission: (t: string, id: string) =>
    request<ProcessResult>(`/submissions/${id}/process`, t, { method: 'POST' }),
  latestGrading: (t: string, studentId: string) =>
    request<Stage2GradingAndAffectOutput>(`/students/${studentId}/gradings/latest`, t),
  /** Past uploads, newest first (up to 50). */
  gradings: (t: string, studentId: string) =>
    request<Stage2GradingAndAffectOutput[]>(`/students/${studentId}/gradings`, t),
  /** Testing accounts: grade an earlier upload again with the current grader. Replaces its old result. */
  regrade: (t: string, submissionId: string) =>
    request<ProcessResult>(`/submissions/${submissionId}/regrade`, t, { method: 'POST' }),
  worksheet: (t: string, gradingId: string) => request<WS_3STAGE_V1>(`/gradings/${gradingId}/worksheet`, t),
  parentSummary: (t: string, studentId: string) =>
    request<ParentProjectionSummary>(`/students/${studentId}/parent-summary`, t),
  /**
   * Chrome extension upload, step 1: a one-time link (15 minutes). Step 2: PUT the raw image
   * bytes to API_URL + uploadUrl with no Authorization header; the response is the submission.
   */
  createUpload: (
    t: string,
    body: { studentId: string; course: string; unitTopic: string; sharpnessScore: number },
  ) => request<ApiUploadTicket>('/uploads', t, json(body)),
  /** The worksheet as a PDF (Pro, once the worksheet is ready). Use URL.createObjectURL to download. */
  worksheetPdf: async (t: string, gradingId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/gradings/${gradingId}/worksheet.pdf`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new ApiError(res.status, 'The worksheet PDF is not available yet.');
    return res.blob();
  },
  /** Upgrade to Pro: returns the Stripe Checkout URL; send the browser there (window.location). */
  startCheckout: (t: string) => request<{ url: string }>('/billing/checkout', t, { method: 'POST' }),
  /** Manage or cancel the subscription: returns the Stripe portal URL. 404 NO_SUBSCRIPTION if never subscribed. */
  billingPortal: (t: string) => request<{ url: string }>('/billing/portal', t, { method: 'POST' }),
  /** Google Classroom (Pro teacher accounts). */
  classroomStatus: (t: string) =>
    request<{ configured: boolean; plan: PlanTier; connected: boolean }>('/classroom/status', t),
  /** Returns Google's consent URL; Google returns the teacher to /teacher?classroom=connected|failed. */
  classroomConnect: (t: string) => request<{ url: string }>('/classroom/connect', t, { method: 'POST' }),
  classroomDisconnect: (t: string) => request<void>('/classroom', t, { method: 'DELETE' }),
  classroomCourses: (t: string) => request<ClassroomCourse[]>('/classroom/courses', t),
  classroomCoursework: (t: string, courseId: string) =>
    request<ClassroomCoursework[]>(`/classroom/courses/${courseId}/coursework`, t),
  /** Imports handed-in photos as submissions (ungraded). Then call processSubmission for each. */
  classroomImport: (t: string, courseId: string, workId: string, body: { course: string; unitTopic: string }) =>
    request<ClassroomImportResult>(`/classroom/courses/${courseId}/coursework/${workId}/import`, t, json(body)),
  classroomSync: (t: string, courseId: string, workId: string, submissionIds?: string[]) =>
    request<LmsSyncResult>(`/classroom/courses/${courseId}/coursework/${workId}/sync`, t, json({ submissionIds })),
  /** Multi-LMS (Brightspace, Canvas, Microsoft Teams for Education, plus Google Classroom status). */
  lmsProviders: (t: string) => request<LmsProviderStatus[]>('/lms/providers', t),
  lmsConnect: (t: string, provider: Exclude<LmsProviderId, 'google_classroom'>, instanceUrl?: string) =>
    request<{ url: string }>(`/lms/${provider}/connect`, t, json({ instanceUrl: instanceUrl || null })),
  lmsDisconnect: (t: string, provider: Exclude<LmsProviderId, 'google_classroom'>) =>
    request<void>(`/lms/${provider}`, t, { method: 'DELETE' }),
  lmsCourses: (t: string, provider: Exclude<LmsProviderId, 'google_classroom'>) =>
    request<ClassroomCourse[]>(`/lms/${provider}/courses`, t),
  lmsAssignments: (t: string, provider: Exclude<LmsProviderId, 'google_classroom'>, courseId: string) =>
    request<ClassroomCoursework[]>(`/lms/${provider}/courses/${encodeURIComponent(courseId)}/assignments`, t),
  lmsImport: (
    t: string,
    provider: Exclude<LmsProviderId, 'google_classroom'>,
    courseId: string,
    workId: string,
    body: { course: string; unitTopic: string },
  ) =>
    request<ClassroomImportResult>(
      `/lms/${provider}/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(workId)}/import`,
      t,
      json(body),
    ),
  lmsSync: (
    t: string,
    provider: Exclude<LmsProviderId, 'google_classroom'>,
    courseId: string,
    workId: string,
    submissionIds?: string[],
  ) =>
    request<LmsSyncResult>(
      `/lms/${provider}/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(workId)}/sync`,
      t,
      json({ submissionIds }),
    ),
  /** School LMS SSO (Brightspace, Canvas, Microsoft). */
  lmsSsoConnect: (provider: Exclude<LmsProviderId, 'google_classroom'>, instanceUrl?: string) =>
    fetch(`${API_URL}/auth/lms/${provider}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceUrl: instanceUrl || null }),
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new ApiError(r.status, body.detail || 'SSO start failed');
      }
      return r.json() as Promise<{ url: string }>;
    }),
  teacherStudents: (t: string) => request<RosterStudent[]>('/teacher/students', t),
  /** Results over time for one student (student, linked parent or their teacher). */
  progress: (t: string, studentId: string) => request<ProgressReport>(`/students/${studentId}/progress`, t),
  /** Class overview for a Pro teacher. 402 PRO_ONLY on Free. */
  teacherReport: (t: string, googleCourseId?: string) =>
    request<CohortReport>(`/teacher/report${googleCourseId ? `?googleCourseId=${encodeURIComponent(googleCourseId)}` : ''}`, t),
  /** Plan and uploads left this month. A 402 FREE_LIMIT_REACHED on upload means remaining hit 0. */
  usage: (t: string, studentId: string) => request<ApiUsage>(`/students/${studentId}/usage`, t),
  updateProfile: (t: string, name: string) => request<UserProfile>('/me', t, { ...json({ name }), method: 'PATCH' }),
  myClasses: (t: string) => request<ApiClass[]>('/me/classes', t),
  joinClass: (t: string, joinCode: string) => request<ApiClass[]>('/me/classes', t, json({ joinCode })),
  leaveClass: (t: string, classId: string) => request<ApiClass[]>(`/me/classes/${classId}`, t, { method: 'DELETE' }),
  /** Deletes the account; for a student, all of their data too. Confirm first, then sign out. */
  deleteMe: (t: string) => request<void>('/me', t, { method: 'DELETE' }),
  /** A student or a linked parent deletes everything stored for that student. */
  deleteStudentData: (t: string, studentId: string) =>
    request<void>(`/students/${studentId}`, t, { method: 'DELETE' }),
};
