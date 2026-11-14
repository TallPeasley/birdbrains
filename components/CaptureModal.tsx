'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRole } from '@/lib/roleContext';
import { analyzeImage, MIN_SHORT_EDGE, type ImageQualityResult } from '@/lib/imageQuality';
import { demoPersonas } from '@/lib/mockData';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { GradeCourse, SubmissionIngestionPayload } from '@/types/birdBrains';

const UNITS: Record<GradeCourse, string[]> = {
  MTH1W: ['Number Sense', 'Algebra & Linear Relations', 'Data', 'Geometry & Measurement', 'Financial Literacy'],
  MPM2D: ['Linear Systems', 'Analytic Geometry', 'Quadratic Relations', 'Completing the Square', 'Trigonometry'],
};

type Stage = 'IDLE' | 'UPLOADING' | 'PRE_CHECKING' | 'INGESTING' | 'PROCESSING' | 'DONE' | 'ERROR';
const PIPELINE: { stage: Stage; label: string }[] = [
  { stage: 'UPLOADING', label: 'Uploading' },
  { stage: 'PRE_CHECKING', label: 'Pre-Checking Sharpness' },
  { stage: 'INGESTING', label: 'Ingesting via Pipeline' },
  { stage: 'PROCESSING', label: 'Processing Diagnostic' },
];

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  quality?: ImageQualityResult;
  error?: string;
}

const TIER_STYLE = {
  EXCELLENT: { label: 'Excellent', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500' },
  ACCEPTABLE: { label: 'Acceptable', cls: 'bg-amber-50 text-amber-800 ring-amber-200', bar: 'bg-amber-500' },
  TOO_BLURRY: { label: 'Too Blurry', cls: 'bg-rose-50 text-rose-700 ring-rose-200', bar: 'bg-rose-500' },
} as const;

export default function CaptureModal() {
  const { isCaptureOpen, closeCapture } = useRole();
  const { live, profile, activeStudentId, getToken, bumpData } = useSession();
  const [problem, setProblem] = useState<{ message: string; failedAt: number } | null>(null);
  const runId = useRef(0);
  const [studentId, setStudentId] = useState<string>(demoPersonas.student.id);
  const [course, setCourse] = useState<GradeCourse>('MPM2D');
  const [unit, setUnit] = useState(UNITS.MPM2D[3]);
  const [tags, setTags] = useState<string[]>(['vertex form']);
  const [tagDraft, setTagDraft] = useState('');
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>('IDLE');
  const [payload, setPayload] = useState<SubmissionIngestionPayload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    runId.current++;
    setProblem(null);
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setStage('IDLE');
    setPayload(null);
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
    setFiles((prev) => [...prev, ...incoming]);
    incoming.forEach(async (q) => {
      if (!q.file.type.startsWith('image/')) {
        setFiles((prev) => prev.map((f) => (f.id === q.id ? { ...f, error: 'Not an image file' } : f)));
        return;
      }
      try {
        const quality = await analyzeImage(q.file);
        setFiles((prev) => prev.map((f) => (f.id === q.id ? { ...f, quality } : f)));
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

  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft('');
  };

  const analyzing = files.some((f) => !f.quality && !f.error);
  const allPassed = files.length > 0 && files.every((f) => f.quality?.passed);
  // Live: the upload goes to the signed-in student (or the parent's selected child).
  const targetStudentId = live ? (activeStudentId ?? '') : studentId.trim();
  const canSubmit = allPassed && !analyzing && targetStudentId !== '' && stage === 'IDLE';

  const submit = () => {
    if (!canSubmit) return;
    const qualities = files.map((f) => f.quality!);
    const weakest = qualities.reduce((a, b) => (a.sharpnessScore <= b.sharpnessScore ? a : b));
    const smallest = qualities.reduce((a, b) =>
      Math.min(a.width, a.height) <= Math.min(b.width, b.height) ? a : b,
    );
    const unitTopic = [unit, ...tags].join(' · ');
    if (live) {
      void submitLive(unitTopic, weakest.sharpnessScore);
      return;
    }
    const p: SubmissionIngestionPayload = {
      submissionId: `sub_${Date.now().toString().slice(-7)}`,
      studentId: targetStudentId,
      course,
      unitTopic,
      imageResolution: { width: smallest.width, height: smallest.height },
      sharpnessScore: weakest.sharpnessScore,
      isQualityPassed: true,
      uploadedAt: new Date().toISOString(),
      fileUrls: files.map((f) => f.previewUrl),
    };
    // Demo mode (no backend configured): simulated pipeline.
    const steps: Stage[] = ['UPLOADING', 'PRE_CHECKING', 'INGESTING', 'PROCESSING', 'DONE'];
    steps.forEach((s, i) =>
      timers.current.push(
        setTimeout(() => {
          setStage(s);
          if (s === 'DONE') setPayload(p);
        }, i * 1100),
      ),
    );
  };

  const submitLive = async (unitTopic: string, sharpnessScore: number) => {
    const run = ++runId.current;
    const alive = () => run === runId.current;
    let reached = 0;
    const go = (s: Stage) => {
      if (!alive()) return;
      reached = Math.max(reached, PIPELINE.findIndex((p) => p.stage === s));
      setStage(s);
    };
    let poll: ReturnType<typeof setInterval> | undefined;
    try {
      const token = await getToken();
      go('UPLOADING');
      const form = new FormData();
      form.set('studentId', targetStudentId);
      form.set('course', course);
      form.set('unitTopic', unitTopic);
      form.set('sharpnessScore', String(sharpnessScore));
      files.forEach((f) => form.append('files', f.file));
      // The server re-checks type, resolution and sharpness as part of this call.
      const created = await api.createSubmission(token, form);
      go('PRE_CHECKING');
      // Stage 1 (transcription) then Stage 2 (diagnostic) run inside one request;
      // poll the submission's status to show which one is in flight.
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
        throw new ApiError(422, 'We couldn’t read the handwriting clearly enough. Please retake the photo in good light and try again.');
      }
      setPayload(result.submission);
      setStage('DONE');
      bumpData();
    } catch (err) {
      if (!alive()) return;
      setProblem({
        message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        failedAt: reached,
      });
      setStage('ERROR');
    } finally {
      clearInterval(poll);
    }
  };

  if (!isCaptureOpen) return null;
  const activeIndex = stage === 'ERROR' ? (problem?.failedAt ?? 0) : PIPELINE.findIndex((p) => p.stage === stage);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="capture-title" className="text-lg font-semibold text-slate-900">
              Upload student work
            </h2>
            <p className="text-sm text-slate-500">
              Photos are checked for resolution and sharpness before they enter the pipeline.
            </p>
          </div>
          <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {stage === 'IDLE' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Student ID</span>
                  <input
                    value={live ? targetStudentId : studentId}
                    readOnly={live}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-50 read-only:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </label>
                <fieldset>
                  <legend className="mb-1 block text-sm font-medium text-slate-700">Grade / Course</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(['MTH1W', 'MPM2D'] as GradeCourse[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCourse(c);
                          setUnit(UNITS[c][0]);
                        }}
                        aria-pressed={course === c}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          course === c
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-500'
                            : 'border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="block font-semibold">{c}</span>
                        <span className="block text-xs text-slate-500">{c === 'MTH1W' ? 'Grade 9' : 'Grade 10'}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Unit</span>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {UNITS[course].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="mb-1 block text-sm font-medium text-slate-700">Topic tags</span>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 px-2 py-1.5 focus-within:border-indigo-500">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        <Tag className="h-3 w-3" aria-hidden />
                        {t}
                        <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      onBlur={addTag}
                      placeholder="Add tag…"
                      className="min-w-[6rem] flex-1 border-0 p-1 text-sm focus:ring-0"
                    />
                  </div>
                </div>
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                  dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="h-9 w-9 text-indigo-500" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-slate-800">Drag photos here, or click to browse</p>
                <p className="text-xs text-slate-500">
                  At least 1080p (shorter side ≥ {MIN_SHORT_EDGE}px). Multiple pages allowed.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {files.length > 0 && (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <FileRow key={f.id} item={f} onRemove={() => removeFile(f.id)} />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <PipelineView
              stage={stage}
              activeIndex={activeIndex}
              payload={payload}
              problem={problem?.message}
              onRetry={() => {
                setProblem(null);
                setStage('IDLE');
              }}
              onClose={close}
            />
          )}
        </div>

        {stage === 'IDLE' && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
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
                    : 'Remove or retake photos that failed the check.'}
            </p>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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

function FileRow({ item, onRemove }: { item: QueuedFile; onRemove: () => void }) {
  const q = item.quality;
  const tier = q ? TIER_STYLE[q.tier] : null;
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
            <Loader2 className="h-3 w-3 animate-spin" /> Analysing resolution and sharpness…
          </p>
        ) : (
          <div className="mt-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ring-1 ${
                  q.resolutionOk ? 'bg-slate-100 text-slate-700 ring-slate-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
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
      {q && (q.passed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Passed" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" aria-label="Failed" />)}
      <button onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" aria-label={`Remove ${item.file.name}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function PipelineView({
  stage,
  activeIndex,
  payload,
  problem,
  onRetry,
  onClose,
}: {
  stage: Stage;
  activeIndex: number;
  payload: SubmissionIngestionPayload | null;
  problem?: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const done = stage === 'DONE';
  return (
    <div className="space-y-6 py-2">
      <ol className="space-y-3" aria-live="polite">
        {PIPELINE.map((p, i) => {
          const complete = done || i < activeIndex;
          const failed = stage === 'ERROR' && i === activeIndex;
          const active = !done && !failed && i === activeIndex;
          return (
            <li key={p.stage} className="flex items-center gap-3">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${
                  complete ? 'bg-emerald-500 text-white' : failed ? 'bg-rose-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : failed ? <AlertTriangle className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
              </span>
              <span className={`text-sm ${complete || active || failed ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>
      {stage === 'ERROR' && (
        <div className="space-y-4">
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {problem}
          </div>
          <div className="flex justify-end">
            <button onClick={onRetry} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Back to photos
            </button>
          </div>
        </div>
      )}
      {done && payload && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Submission <span className="font-mono">{payload.submissionId}</span> is in. The diagnostic is ready on the
            student dashboard.
          </div>
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-600">SubmissionIngestionPayload</summary>
            <pre className="mt-2 overflow-x-auto text-slate-700">{JSON.stringify(payload, null, 2)}</pre>
          </details>
          <div className="flex justify-end">
            <Link
              href="/student"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View diagnostic
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
