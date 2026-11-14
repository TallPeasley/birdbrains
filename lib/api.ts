import type {
  ApiClass,
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
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = 'Some of the details entered are not valid.';
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
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
  register: (t: string, body: { role: 'student' | 'parent'; name: string; course?: string }) =>
    request<UserProfile>('/me', t, json(body)),
  linkChild: (t: string, linkCode: string) => request<UserProfile>('/me/children', t, json({ linkCode })),
  createSubmission: (t: string, form: FormData) =>
    request<SubmissionIngestionPayload>('/submissions', t, { method: 'POST', body: form }),
  getSubmission: (t: string, id: string) => request<SubmissionIngestionPayload>(`/submissions/${id}`, t),
  processSubmission: (t: string, id: string) =>
    request<ProcessResult>(`/submissions/${id}/process`, t, { method: 'POST' }),
  latestGrading: (t: string, studentId: string) =>
    request<Stage2GradingAndAffectOutput>(`/students/${studentId}/gradings/latest`, t),
  worksheet: (t: string, gradingId: string) => request<WS_3STAGE_V1>(`/gradings/${gradingId}/worksheet`, t),
  parentSummary: (t: string, studentId: string) =>
    request<ParentProjectionSummary>(`/students/${studentId}/parent-summary`, t),
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
