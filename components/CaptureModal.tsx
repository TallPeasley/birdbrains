'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CopyCheck,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRole } from '@/lib/roleContext';
import { analyzeImage, MIN_SHORT_EDGE, type ImageQualityResult } from '@/lib/imageQuality';
import { codePillar, mistakeName, uniqueMistakes } from '@/lib/errorCodes';
import { PILLARS } from '@/lib/pillars';
import { demoPersonas, gradingOutput as demoGrading } from '@/lib/mockData';
import { api, ApiError } from '@/lib/api';
import { UPLOAD_ERRORS, uploadErrorCode } from '@/lib/uploadErrors';
import { useSession } from '@/lib/session';
import PhoneQrPanel from '@/components/PhoneQrPanel';
import { MathText } from '@/components/MathText';
import type {
  ApiPhoneUpload,
  Stage2GradingAndAffectOutput,
  SubmissionIngestionPayload,
} from '@/types/birdBrains';

const MAX_FILES = 6;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type Stage =
  | 'IDLE'
  | 'UPLOADING'
  | 'PRE_CHECKING'
  | 'INGESTING'
  | 'PROCESSING'
  | 'DONE'
  | 'DUPLICATE'
  | 'NEEDS_RETAKE'
  | 'ERROR';

const PIPELINE: { stage: Stage; label: string; detail: string }[] = [
  { stage: 'UPLOADING', label: 'Uploading your photos', detail: 'Sending your pages and blurring any names or dates.' },
  { stage: 'PRE_CHECKING', label: 'Checking the photos are clear', detail: 'Confirming size and sharpness.' },
  { stage: 'INGESTING', label: 'Reading your handwriting', detail: 'Turning each handwritten line into math steps.' },
  { stage: 'PROCESSING', label: 'Checking each step of your work', detail: 'Finding where steps went well or slipped.' },
];

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  quality?: ImageQualityResult;
  error?: string;
}

interface ProblemState {
  /** Upload failure code, see lib/uploadErrors.ts. */
  code?: number;
  message: string;
  failedAt: number;
  status?: number;
}

const TIER_STYLE = {
  EXCELLENT: { label: 'Sharp', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500' },
  ACCEPTABLE: { label: 'Readable', cls: 'bg-amber-50 text-amber-800 ring-amber-200', bar: 'bg-amber-500' },
  TOO_BLURRY: { label: 'Too Blurry · Code 101', cls: 'bg-rose-50 text-rose-700 ring-rose-200', bar: 'bg-rose-500' },
} as const;

export default function CaptureModal() {
  const { isCaptureOpen, closeCapture, captureContext } = useRole();
  const { live, profile, activeStudentId, getToken, bumpData } = useSession();
  const [problem, setProblem] = useState<ProblemState | null>(null);
  const runId = useRef(0);
  const [studentId, setStudentId] = useState<string>(demoPersonas.student.id);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>('IDLE');
  const [payload, setPayload] = useState<SubmissionIngestionPayload | null>(null);
  const [grading, setGrading] = useState<Stage2GradingAndAffectOutput | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Phones and tablets get a separate "Take photo" button that opens the rear camera directly
  // (works in the installed app on iPhone and Android, where there is no drag and drop).
  const cameraRef = useRef<HTMLInputElement>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Set while the result on screen comes from photos sent by a phone (the QR code).
  const phoneRun = useRef(false);
  const phonePoll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearInterval(phonePoll.current);
    phoneRun.current = false;
    runId.current++;
    setProblem(null);
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setStage('IDLE');
    setPayload(null);
    setGrading(null);
  }, []);

  const close = useCallback(() => {
    closeCapture();
    reset();
  }, [closeCapture, reset]);

  useEffect(() => {
    if (!isCaptureOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCaptureOpen, close]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => {
      const existingSignatures = new Set(prev.map((f) => `${f.file.name}:${f.file.size}:${f.file.lastModified}`));
      const annotated = incoming.map((q) => {
        const sig = `${q.file.name}:${q.file.size}:${q.file.lastModified}`;
        if (existingSignatures.has(sig)) {
          return { ...q, error: 'Code 108 · Duplicate photo: this file is already in your upload list.' };
        }
        existingSignatures.add(sig);
        if (q.file.size > MAX_FILE_BYTES) {
          return { ...q, error: 'Code 106 · File is over 12 MB. Please choose a smaller photo.' };
        }
        if (!q.file.type.startsWith('image/')) {
          return { ...q, error: 'Code 105 · Not an image file. Use a JPEG, PNG, or WebP photo.' };
        }
        return q;
      });
      return [...prev, ...annotated].slice(0, MAX_FILES);
    });

    incoming.forEach(async (q) => {
      if (!q.file.type.startsWith('image/') || q.file.size > MAX_FILE_BYTES) return;
      try {
        const quality = await analyzeImage(q.file);
        setFiles((prev) =>
          prev.map((f) => (f.id === q.id && !f.error ? { ...f, quality } : f)),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.id === q.id ? { ...f, error: (err as Error).message } : f)),
        );
      }
    });
  };

  const removeFile = (id: string) =>
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((f) => f.id !== id);
    });

  const analyzing = files.some((f) => !f.quality && !f.error);
  const allPassed =
    files.length > 0 &&
    files.length <= MAX_FILES &&
    files.every((f) => !f.error && f.quality?.passed);
  const targetStudentId = live ? (activeStudentId ?? '') : studentId.trim();
  const canSubmit = allPassed && !analyzing && targetStudentId !== '' && stage === 'IDLE';

  const failedCount = files.filter((f) => f.error || (f.quality && !f.quality.passed)).length;

  /** Drop the photos that failed the check and open the picker for a new one. */
  const retake = () => {
    files
      .filter((f) => f.error || (f.quality && !f.quality.passed))
      .forEach((f) => removeFile(f.id));
    setStage('IDLE');
    setProblem(null);
    (touch ? cameraRef : inputRef).current?.click();
  };

  const submit = (again = false) => {
    if (again ? !(allPassed && !analyzing && targetStudentId !== '') : !canSubmit) return;
    const qualities = files.map((f) => f.quality!);
    const weakest = qualities.reduce((a, b) => (a.sharpnessScore <= b.sharpnessScore ? a : b));
    const smallest = qualities.reduce((a, b) =>
      Math.min(a.width, a.height) <= Math.min(b.width, b.height) ? a : b,
    );
    if (live) {
      void submitLive(weakest.sharpnessScore);
      return;
    }
    const p: SubmissionIngestionPayload = {
      submissionId: `sub_${Date.now().toString().slice(-7)}`,
      studentId: targetStudentId,
      course: 'MPM2D',
      unitTopic: demoGrading.topic,
      imageResolution: { width: smallest.width, height: smallest.height },
      sharpnessScore: weakest.sharpnessScore,
      isQualityPassed: true,
      uploadedAt: new Date().toISOString(),
      fileUrls: files.map((f) => f.previewUrl),
      status: 'GRADED',
      gradingId: demoGrading.gradingId,
    };
    const steps: Stage[] = ['UPLOADING', 'PRE_CHECKING', 'INGESTING', 'PROCESSING', 'DONE'];
    steps.forEach((s, i) =>
      timers.current.push(
        setTimeout(() => {
          setStage(s);
          if (s === 'DONE') {
            setPayload(p);
            setGrading(demoGrading);
          }
        }, i * 950),
      ),
    );
  };

  const submitLive = async (sharpnessScore: number) => {
    const run = ++runId.current;
    const alive = () => run === runId.current;
    let reached = 0;
    const go = (s: Stage) => {
      if (!alive()) return;
      const idx = PIPELINE.findIndex((p) => p.stage === s);
      if (idx >= 0) reached = Math.max(reached, idx);
      setStage(s);
    };
    let poll: ReturnType<typeof setInterval> | undefined;
    try {
      const token = await getToken();
      go('UPLOADING');
      const form = new FormData();
      form.set('studentId', targetStudentId);
      form.set('sharpnessScore', String(sharpnessScore));
      if (captureContext?.worksheetGradingId) {
        form.set('worksheetGradingId', captureContext.worksheetGradingId);
        form.set('worksheetProblem', captureContext.problem.slice(0, 500));
      }
      if (captureContext?.classroomCourseId && captureContext.classroomWorkId) {
        form.set('classroomCourseId', captureContext.classroomCourseId);
        form.set('classroomWorkId', captureContext.classroomWorkId);
      }
      files.forEach((f) => form.append('files', f.file));

      const created = await api.createSubmission(token, form);
      go('PRE_CHECKING');

      poll = setInterval(() => {
        api
          .getSubmission(token, created.submissionId)
          .then((sub) => {
            if (sub.status === 'TRANSCRIBING') go('INGESTING');
            else if (sub.status === 'GRADING') go('PROCESSING');
          })
          .catch(() => {});
      }, 1500);

      const result = await api.processSubmission(token, created.submissionId);
      if (!alive()) return;
      if (result.submission.status === 'NEEDS_RETAKE') {
        const code = result.submission.failureCode && UPLOAD_ERRORS[result.submission.failureCode] ? result.submission.failureCode : 201;
        setProblem({
          code,
          message: UPLOAD_ERRORS[code].message,
          failedAt: 2,
          status: 422,
        });
        setStage('NEEDS_RETAKE');
        return;
      }
      setPayload(result.submission);
      setGrading(result.grading);
      setStage('DONE');
      bumpData();
    } catch (err) {
      if (!alive()) return;
      if (err instanceof ApiError && err.status === 409) {
        setProblem({
          code: uploadErrorCode(409, err.detail, err.code ?? 108),
          message:
            err.detail || 'This photo was already uploaded earlier. Open your student dashboard to see that diagnostic.',
          failedAt: 0,
          status: 409,
        });
        setStage('DUPLICATE');
        return;
      }
      if (err instanceof ApiError && err.status === 422) {
        setProblem({
          code: uploadErrorCode(422, err.detail, err.code),
          message:
            err.detail || 'The photo is too blurry or below 1080p. Please retake it in good light and try again.',
          failedAt: 1,
          status: 422,
        });
        setStage('NEEDS_RETAKE');
        return;
      }
      const message =
        err instanceof ApiError && err.detail === 'FREE_LIMIT_REACHED'
          ? 'You have used all 10 Free uploads for this calendar month. Your allowance resets on the 1st of next month.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      setProblem({
        code: err instanceof ApiError ? uploadErrorCode(err.status, err.detail, err.code) : 900,
        message,
        failedAt: reached,
        status: err instanceof ApiError ? err.status : undefined,
      });
      setStage('ERROR');
    } finally {
      clearInterval(poll);
    }
  };

  /** Follow photos sent from a phone through the same progress steps as a computer upload. */
  const onPhoneUpdate = async (s: ApiPhoneUpload) => {
    if (s.state === 'PROCESSING' && s.submissionId) {
      const run = ++runId.current;
      phoneRun.current = true;
      setProblem(null);
      setStage('PRE_CHECKING');
      clearInterval(phonePoll.current);
      const id = s.submissionId;
      phonePoll.current = setInterval(async () => {
        try {
          const sub = await api.getSubmission(await getToken(), id);
          if (run !== runId.current) return;
          if (sub.status === 'TRANSCRIBING') setStage('INGESTING');
          else if (sub.status === 'GRADING') setStage('PROCESSING');
        } catch {
          /* keep showing the last step */
        }
      }, 1500);
      return;
    }
    // A quick read can finish between two checks, so a finished link also starts a phone run.
    if (!s.submissionId) return;
    if (!phoneRun.current) {
      ++runId.current;
      phoneRun.current = true;
    }
    clearInterval(phonePoll.current);
    const run = runId.current;
    if (s.state === 'DONE') {
      try {
        // Already graded by the phone's request; this returns that result.
        const result = await api.processSubmission(await getToken(), s.submissionId);
        if (run !== runId.current) return;
        setPayload(result.submission);
        setGrading(result.grading);
        setStage('DONE');
        bumpData();
      } catch (err) {
        if (run !== runId.current) return;
        setProblem({ code: 900, message: err instanceof Error ? err.message : 'Could not load the result.', failedAt: 3 });
        setStage('ERROR');
      }
    } else if (s.state === 'NEEDS_RETAKE') {
      const code = s.failureCode && UPLOAD_ERRORS[s.failureCode] ? s.failureCode : 201;
      setProblem({ code, message: UPLOAD_ERRORS[code].message, failedAt: 2, status: 422 });
      setStage('NEEDS_RETAKE');
    } else if (s.state === 'FAILED') {
      const code = s.failureCode && UPLOAD_ERRORS[s.failureCode] ? s.failureCode : 900;
      setProblem({ code, message: UPLOAD_ERRORS[code]?.message ?? 'Something went wrong. Please try again.', failedAt: 3 });
      setStage('ERROR');
    }
  };

  const showPhone = live && !touch && targetStudentId !== '';

  if (!isCaptureOpen) return null;
  const activeIndex =
    stage === 'ERROR' || stage === 'DUPLICATE' || stage === 'NEEDS_RETAKE'
      ? (problem?.failedAt ?? 0)
      : PIPELINE.findIndex((p) => p.stage === stage);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 id="capture-title" className="text-lg font-semibold text-slate-900">
              {captureContext ? 'Upload your work' : 'Upload student work'}
            </h2>
            {captureContext ? (
              <p className="text-sm text-slate-600">
                For{' '}
                {captureContext.classroomWorkId ? (
                  `${captureContext.problem} (Google Classroom)`
                ) : (
                  <MathText text={captureContext.problem} />
                )}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                We check each photo is big and sharp enough to read before it is sent.
              </p>
            )}
          </div>
          <button
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {/* Kept mounted through the progress steps so it keeps watching for the phone's photos. */}
          {showPhone && (
            <div className={stage === 'IDLE' ? 'rounded-2xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100' : 'hidden'}>
              <PhoneQrPanel
                compact
                request={{
                  kind: 'new',
                  studentId: targetStudentId,
                  ...(captureContext?.worksheetGradingId
                    ? { worksheetGradingId: captureContext.worksheetGradingId, problem: captureContext.problem.slice(0, 500) }
                    : {}),
                  ...(captureContext?.classroomCourseId && captureContext.classroomWorkId
                    ? {
                        classroomCourseId: captureContext.classroomCourseId,
                        classroomWorkId: captureContext.classroomWorkId,
                        problem: captureContext.problem.slice(0, 500),
                      }
                    : {}),
                }}
                onUpdate={(s) => void onPhoneUpdate(s)}
              />
            </div>
          )}
          {stage === 'IDLE' ? (
            <>
              <div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Student ID</span>
                  <input
                    value={live ? targetStudentId : studentId}
                    readOnly={live}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-50 read-only:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </label>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition sm:px-6 sm:py-8 ${
                  dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="h-9 w-9 text-indigo-500" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-slate-800">Drag photos here, or tap to choose</p>
                <p className="text-xs text-slate-500">
                  JPEG, PNG or WebP · at least 1080p (shorter side ≥ {MIN_SHORT_EDGE}px) · up to {MAX_FILES} pages (12 MB each).
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {touch && (
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="w-full btn btn-lg btn-primary"
                >
                  <Camera className="h-5 w-5" aria-hidden /> Take photo
                </button>
              )}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <span>
                  Before a photo is saved, BirdBrains blurs names, dates, class and student-number fields and removes location data.
                </span>
              </p>

              {files.length > 0 && (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <FileRow key={f.id} item={f} onRemove={() => removeFile(f.id)} />
                  ))}
                </ul>
              )}

              {failedCount > 0 && !analyzing && (
                <RetakeTipsCard
                  title={
                    failedCount === 1
                      ? 'One photo is too blurry, too small, or cannot be used'
                      : `${failedCount} photos are too blurry, too small, or cannot be used`
                  }
                  onRetake={retake}
                />
              )}
            </>
          ) : (
            <PipelineView
              stage={stage}
              activeIndex={activeIndex}
              payload={payload}
              grading={grading}
              problem={problem}
              onRetry={() => {
                setProblem(null);
                if (phoneRun.current) {
                  reset();
                  return;
                }
                submit(true);
              }}
              onRetake={() => {
                setProblem(null);
                if (phoneRun.current) {
                  reset(); // the phone code stays open for another photo
                  return;
                }
                reset();
                setTimeout(() => (touch ? cameraRef : inputRef).current?.click(), 50);
              }}
              onBack={() => {
                setProblem(null);
                setStage('IDLE');
              }}
              onClose={close}
            />
          )}
        </div>

        {stage === 'IDLE' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
            <p className="text-xs text-slate-500">
              {live && !targetStudentId
                ? profile
                  ? 'Link a student on the parent dashboard before uploading.'
                  : 'Sign in on the home page before uploading.'
                : files.length === 0
                  ? 'Add at least one photo.'
                  : analyzing
                    ? 'Checking image quality…'
                    : allPassed
                      ? `${files.length} photo${files.length > 1 ? 's' : ''} ready.`
                      : 'Retake or remove the photos that did not pass the check.'}
            </p>
            <button
              onClick={() => submit()}
              disabled={!canSubmit}
              className="btn btn-primary"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Submit for diagnosis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RetakeTipsCard({
  title,
  message,
  onRetake,
}: {
  title: string;
  message?: string;
  onRetake: () => void;
}) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0 space-y-2 text-sm text-amber-900">
        <p className="font-semibold">{title}</p>
        {message && <p className="text-amber-800">{message}</p>}
        <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800">
          <li>Place the page on a flat table in bright light with no shadows across your writing.</li>
          <li>Hold the phone steady directly above the page so the lines aren&apos;t angled.</li>
          <li>Fill the frame with the math work so every number and sign looks crisp.</li>
        </ul>
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Camera className="h-4 w-4" aria-hidden /> Retake photo
        </button>
      </div>
    </div>
  );
}

function FileRow({ item, onRemove }: { item: QueuedFile; onRemove: () => void }) {
  const q = item.quality;
  const tier = q ? TIER_STYLE[q.tier] : null;
  const passed = !item.error && Boolean(q?.passed);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{item.file.name}</p>
        {item.error ? (
          <p className="text-xs text-rose-600">{item.error}</p>
        ) : !q ? (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Checking resolution and sharpness…
          </p>
        ) : (
          <div className="mt-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ring-1 ${
                  q.resolutionOk
                    ? 'bg-slate-100 text-slate-700 ring-slate-200'
                    : 'bg-rose-50 text-rose-700 ring-rose-200'
                }`}
              >
                {q.width}×{q.height}
                {!q.resolutionOk && ' · below 1080p'}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${tier!.cls}`}>{tier!.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${tier!.bar}`} style={{ width: `${q.sharpnessScore}%` }} />
              </div>
              <span className="w-24 text-right text-[11px] tabular-nums text-slate-500">
                sharpness {q.sharpnessScore}/100
              </span>
            </div>
          </div>
        )}
      </div>
      {(q || item.error) &&
        (passed ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Passed" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" aria-label="Failed" />
        ))}
      <button
        onClick={onRemove}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
        aria-label={`Remove ${item.file.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

/** "Code 201 · Handwriting unclear" and what to do next, for any failed upload. */
function ErrorCodeLine({ code }: { code?: number }) {
  const info = code ? UPLOAD_ERRORS[code] : undefined;
  if (!code || !info) return null;
  return (
    <div className="mt-2 text-xs text-slate-600">
      <p>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-700">Code {code}</span>{' '}
        {info.title}
      </p>
      <p className="mt-1">{info.action}</p>
      {info.ours && <p className="mt-1 text-slate-500">This one is on our side, not yours. If it keeps happening, tell us the code.</p>}
    </div>
  );
}

function PipelineView({
  stage,
  activeIndex,
  payload,
  grading,
  problem,
  onRetry,
  onRetake,
  onBack,
  onClose,
}: {
  stage: Stage;
  activeIndex: number;
  payload: SubmissionIngestionPayload | null;
  grading: Stage2GradingAndAffectOutput | null;
  problem: ProblemState | null;
  onRetry: () => void;
  onRetake: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const done = stage === 'DONE';
  const duplicate = stage === 'DUPLICATE';
  const needsRetake = stage === 'NEEDS_RETAKE';
  const errored = stage === 'ERROR';

  if (duplicate) {
    return (
      <div className="space-y-5 py-2">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CopyCheck className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">Same photo already uploaded</h3>
          <p className="mt-1 text-sm text-slate-600">
            {problem?.message ?? 'This photo was already uploaded earlier. Open your earlier diagnostic instead.'}
          </p>
          <ErrorCodeLine code={problem?.code} />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Camera className="h-4 w-4" aria-hidden /> Choose a different photo
          </button>
          <Link
            href="/student"
            onClick={onClose}
            className="btn btn-primary"
          >
            Open earlier diagnostic
          </Link>
        </div>
      </div>
    );
  }

  if (needsRetake) {
    return (
      <div className="space-y-5 py-2">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Camera className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">Please retake a clearer photo</h3>
          <p className="mt-1 text-sm text-slate-600">
            {(problem?.code && UPLOAD_ERRORS[problem.code]?.message) ||
              'We couldn’t read the handwriting clearly enough to grade each line fairly.'}
          </p>
          <ErrorCodeLine code={problem?.code} />
        </div>

        <RetakeTipsCard
          title="How to get a clear photo"
          message={problem?.message}
          onRetake={onRetake}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-secondary"
          >
            Back to photos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {done ? (
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">All done!</h3>
        </div>
      ) : errored ? (
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            {problem?.status === 503
              ? 'Privacy check couldn’t finish'
              : problem?.status === 402
                ? 'Monthly Free upload limit reached'
                : 'That didn’t work'}
          </h3>
        </div>
      ) : (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900">Diagnosing your work…</h3>
          <p className="mt-1 text-sm text-slate-500">This can take a little while. Keep this window open.</p>
        </div>
      )}

      <ol className="space-y-3" aria-live="polite">
        {PIPELINE.map((p, i) => {
          const complete = done || i < activeIndex;
          const failed = errored && i === activeIndex;
          const active = !done && !failed && i === activeIndex;
          return (
            <li key={p.stage} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  complete
                    ? 'bg-emerald-500 text-white'
                    : failed
                      ? 'bg-rose-500 text-white'
                      : active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                }`}
              >
                {complete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : failed ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm ${
                    complete || active || failed ? 'font-semibold text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {p.label}
                </p>
                {(active || failed) && <p className="text-xs text-slate-500">{p.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {errored && (
        <div className="space-y-4">
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {problem?.message ?? 'Something went wrong. Please try again.'}
            <ErrorCodeLine code={problem?.code} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to photos
            </button>
            {problem?.status !== 402 && (
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Try again
              </button>
            )}
          </div>
        </div>
      )}

      {done && payload && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Your work has been checked. See which steps went well and where you got stuck on the student dashboard.
          </div>

          {grading && grading.entityExtractions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mistakes spotted
              </p>
              <ul className="mt-2 space-y-2">
                {uniqueMistakes(grading.entityExtractions).map((m, idx) => {
                  const prefix = codePillar(m.misconceptionId);
                  const pillar = prefix ? PILLARS[prefix] : undefined;
                  return (
                    <li key={`${m.misconceptionId}-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar?.color ?? '#64748b' }} aria-hidden />
                      <span className="font-semibold text-slate-800">{mistakeName(m.misconceptionId)}</span>
                      {m.count > 1 && <span className="text-slate-500">×{m.count}</span>}
                      {pillar && <span className="text-slate-500">· {pillar.short}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">
              Submission details <span className="font-mono">{payload.submissionId}</span>
            </summary>
            <pre className="mt-2 overflow-x-auto text-slate-700">{JSON.stringify(payload, null, 2)}</pre>
          </details>
          <div className="flex justify-end">
            <Link
              href="/student"
              onClick={onClose}
              className="btn btn-primary"
            >
              See the results
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
