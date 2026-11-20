"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  History,
  ImageIcon,
  Info,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import PillarCards from "@/components/student/PillarCards";
import StepDiagnostics from "@/components/student/StepDiagnostics";
import WorksheetViewer from "@/components/student/WorksheetViewer";
import { MathText } from "@/components/MathText";
import { api, API_URL, ApiError } from "@/lib/api";
import { gradingOutput, worksheet as demoWorksheet } from "@/lib/mockData";
import { AFFECT_META, PILLAR_ORDER, PILLARS } from "@/lib/pillars";
import { useSession } from "@/lib/session";
import type {
  Stage2GradingAndAffectOutput,
  WS_3STAGE_V1,
} from "@/types/birdBrains";

type StatusFilter = "ALL" | "READY" | "BUILDING" | "NOT_NEEDED";
type Tab = "worksheet" | "diagnostic";

const STATUS: Record<string, { label: string; tone: string }> = {
  READY: {
    label: "Worksheet ready",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  QUEUED: {
    label: "Worksheet built overnight",
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  PENDING: {
    label: "Worksheet being built",
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  NOT_NEEDED: {
    label: "No worksheet needed",
    tone: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  PRO_ONLY: {
    label: "Worksheet on Pro",
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  FAILED: {
    label: "Worksheet failed",
    tone: "bg-rose-50 text-rose-700 ring-rose-200",
  },
};

const WORKSHEET_NOTES: Record<string, string> = {
  QUEUED:
    "This practice worksheet is built overnight. Check back tomorrow morning.",
  PENDING:
    "This practice worksheet is being built right now. Check back in the morning.",
  NOT_NEEDED:
    "No mistakes to practise from this upload, so no worksheet was needed.",
  PRO_ONLY: "Practice worksheets are part of Pro.",
  FAILED: "A worksheet could not be built for this upload.",
};

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

const pct = (g: Stage2GradingAndAffectOutput) =>
  g.maxPossibleScore
    ? Math.round((g.totalScore / g.maxPossibleScore) * 100)
    : 0;

const scoreTone = (p: number) =>
  p >= 85
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : p >= 70
      ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";

/**
 * Every graded upload for the student in view, newest first, with its diagnostic, the
 * practice worksheet and the photo. Lives on the Account page. In demo mode it shows the
 * sample grading.
 */
export default function UploadHistory() {
  const { live, activeStudentId, getToken, dataVersion } = useSession();
  const [history, setHistory] = useState<Stage2GradingAndAffectOutput[] | null>(
    live ? null : [gradingOutput],
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!live) {
      setHistory([gradingOutput]);
      return;
    }
    if (!activeStudentId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistory(null);
    setError("");
    getToken()
      .then((t) => api.gradings(t, activeStudentId))
      .then((list) => {
        if (!cancelled) setHistory(list);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load your uploads.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [live, activeStudentId, getToken, dataVersion, attempt]);

  const courses = useMemo(
    () =>
      Array.from(
        new Set(
          (history ?? [])
            .map((g) => g.course)
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [history],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (history ?? []).filter((g) => {
      if (course !== "ALL" && g.course !== course) return false;
      const ws = g.worksheetStatus ?? (live ? "" : "READY");
      if (status === "READY" && ws !== "READY") return false;
      if (status === "BUILDING" && ws !== "QUEUED" && ws !== "PENDING")
        return false;
      if (status === "NOT_NEEDED" && ws !== "NOT_NEEDED") return false;
      if (q) {
        const hay = [
          g.topic,
          g.course ?? "",
          ...g.entityExtractions.map((e) => e.misconceptionId),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [history, search, course, status, live]);

  const selected =
    filtered.find((g) => g.gradingId === selectedId) ?? filtered[0] ?? null;
  const average =
    history && history.length
      ? Math.round(history.reduce((a, g) => a + pct(g), 0) / history.length)
      : 0;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="history-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="history-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <History className="h-5 w-5 text-indigo-600" aria-hidden /> Upload
            history
          </h2>
          <p className="text-sm text-slate-500">
            Every graded upload, newest first, with its step-by-step check,
            practice worksheet and photo.
          </p>
        </div>
        {history && history.length > 0 && (
          <span className="text-sm text-slate-500">
            {history.length} upload{history.length === 1 ? "" : "s"} · average{" "}
            <strong className="text-slate-800">{average}%</strong>
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="btn btn-sm btn-secondary"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      ) : history === null ? (
        <p className="mt-4 text-sm text-slate-500" role="status">
          Loading your uploads…
        </p>
      ) : history.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No graded uploads yet. Upload a photo of your work and it will show up
          here.
        </p>
      ) : (
        <>
          {/* Search and filters */}
          <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative w-full sm:w-64">
                <span className="sr-only">
                  Search uploads by topic or error code
                </span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search topic or code (e.g. PRC-03)"
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              {courses.length > 1 && (
                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
                  role="group"
                  aria-label="Course"
                >
                  {["ALL", ...courses].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCourse(c)}
                      aria-pressed={course === c}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        course === c
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {c === "ALL" ? "All courses" : c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 overflow-x-auto"
              role="group"
              aria-label="Worksheet"
            >
              <Filter
                className="h-3.5 w-3.5 shrink-0 text-slate-500"
                aria-hidden
              />
              {(
                [
                  ["ALL", "All"],
                  ["READY", "Worksheet ready"],
                  ["BUILDING", "Being built"],
                  ["NOT_NEEDED", "No worksheet needed"],
                ] as [StatusFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStatus(id)}
                  aria-pressed={status === id}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    status === id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-600">
              No uploads match.{" "}
              <button
                className="btn btn-link btn-sm"
                onClick={() => {
                  setSearch("");
                  setCourse("ALL");
                  setStatus("ALL");
                }}
              >
                Clear the filters
              </button>
            </div>
          ) : (
            <div className="mt-4 grid items-start gap-5 lg:grid-cols-12">
              <ul className="space-y-3 lg:col-span-5" aria-label="Past uploads">
                {filtered.map((g) => (
                  <li key={g.gradingId}>
                    <HistoryCard
                      grading={g}
                      active={selected?.gradingId === g.gradingId}
                      onSelect={() => setSelectedId(g.gradingId)}
                    />
                  </li>
                ))}
              </ul>
              <div className="min-w-0 lg:col-span-7">
                {selected && (
                  <Inspector key={selected.gradingId} grading={selected} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function HistoryCard({
  grading: g,
  active,
  onSelect,
}: {
  grading: Stage2GradingAndAffectOutput;
  active: boolean;
  onSelect: () => void;
}) {
  const p = pct(g);
  const affect = g.affectState ? AFFECT_META[g.affectState] : null;
  const status = g.worksheetStatus ? STATUS[g.worksheetStatus] : null;
  const questions = g.questionAnalyses?.length || g.questions?.length || 1;
  const pillars = PILLAR_ORDER.map((k) =>
    g.pillarBreakdowns.find((b) => b.pillar === k),
  ).filter(Boolean);
  return (
    <button
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
        active
          ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/15"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {g.course && (
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
              {g.course}
            </span>
          )}
          {g.plan === "pro" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
              <Sparkles className="h-3 w-3" aria-hidden /> Pro
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              Free
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="h-3 w-3" aria-hidden />{" "}
            {formatWhen(g.gradedAt)}
          </span>
        </div>
        <span
          className={`latex-num shrink-0 rounded-lg px-2.5 py-0.5 text-xs font-bold ring-1 ${scoreTone(p)}`}
        >
          {g.totalScore.toFixed(1)} / {g.maxPossibleScore.toFixed(1)}
        </span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <span className="font-bold leading-snug text-slate-900">
          {g.topic || "Untitled upload"}
          <span className="ml-1.5 text-xs font-medium text-slate-500">
            · {questions} question{questions === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`}
          aria-hidden
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {pillars.map((b) => {
          const w = b!.maxScore
            ? Math.round((b!.earnedScore / b!.maxScore) * 100)
            : 0;
          return (
            <div
              key={b!.pillar}
              className="rounded-lg border border-slate-100 bg-slate-50 p-1.5"
            >
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-600">
                <span>{b!.pillar}</span>
                <span className="latex-num">
                  {b!.earnedScore}/{b!.maxScore}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${w}%`,
                    backgroundColor: PILLARS[b!.pillar].color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {g.entityExtractions.length > 0 ? (
          g.entityExtractions.map((e, i) => {
            const pillar =
              PILLARS[e.misconceptionId.split("-")[0] as keyof typeof PILLARS];
            return (
              <span
                key={`${e.misconceptionId}-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: pillar?.color ?? "#64748b" }}
                  aria-hidden
                />
                {e.misconceptionId}
              </span>
            );
          })
        ) : (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            No mistakes
          </span>
        )}
        {affect ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${affect.badge}`}
          >
            {affect.label}
          </span>
        ) : g.plan === "free" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
            <Lock className="h-2.5 w-2.5" aria-hidden /> Mood on Pro
          </span>
        ) : null}
      </div>

      {status && (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.tone}`}
          >
            <Clock className="h-3 w-3" aria-hidden /> {status.label}
          </span>
        </div>
      )}
    </button>
  );
}

/** The selected upload: practice worksheet in one tab, the full diagnostic and photo in the other. */
function Inspector({ grading: g }: { grading: Stage2GradingAndAffectOutput }) {
  const { live, getToken } = useSession();
  const [tab, setTab] = useState<Tab>(
    g.worksheetStatus === "READY" || !live ? "worksheet" : "diagnostic",
  );
  const [worksheet, setWorksheet] = useState<WS_3STAGE_V1 | null | undefined>(
    live ? undefined : demoWorksheet,
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!live || tab !== "worksheet" || worksheet !== undefined) return;
    let cancelled = false;
    getToken()
      .then((t) => api.worksheet(t, g.gradingId))
      .then((ws) => {
        if (!cancelled) setWorksheet(ws);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setWorksheet(null);
        const detail =
          err instanceof ApiError ? err.detail.replace(/^WORKSHEET_/, "") : "";
        setNote(
          WORKSHEET_NOTES[detail] ??
            WORKSHEET_NOTES[g.worksheetStatus ?? ""] ??
            "No practice worksheet for this upload.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [live, tab, worksheet, getToken, g.gradingId, g.worksheetStatus]);

  const p = pct(g);
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {g.course && (
              <span className="rounded-md bg-indigo-500 px-2.5 py-0.5 font-bold text-white">
                {g.course}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden /> Graded{" "}
              {formatWhen(g.gradedAt)}
            </span>
          </div>
          <span className="latex-num rounded-xl bg-white/10 px-3 py-1 text-sm font-bold ring-1 ring-white/15">
            {g.totalScore.toFixed(1)} / {g.maxPossibleScore.toFixed(1)} · {p}%
          </span>
        </div>
        <h3 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
          {g.topic || "Untitled upload"}
        </h3>
        <div
          className="-mb-6 mt-5 flex gap-2 overflow-x-auto pt-1"
          role="tablist"
          aria-label="Upload details"
        >
          {(
            [
              ["worksheet", "Practice worksheet", Layers],
              ["diagnostic", "Step-by-step check & photo", FileText],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold ${
                tab === id
                  ? "bg-white text-slate-900"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 text-indigo-500" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {tab === "worksheet" ? (
          worksheet ? (
            <WorksheetViewer worksheet={worksheet} steps={g.stepDiagnostics} />
          ) : worksheet === undefined ? (
            <p className="text-sm text-slate-500" role="status">
              Loading the worksheet…
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <Clock
                className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                aria-hidden
              />{" "}
              {note}
            </p>
          )
        ) : (
          <>
            {g.supportiveFramingMessage && (
              <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-100">
                <Sparkles
                  className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-slate-800">
                  <MathText text={g.supportiveFramingMessage} />
                </p>
              </div>
            )}
            <PillarCards pillars={g.pillarBreakdowns} />
            <StepDiagnostics grading={g} />
            <Photo submissionId={g.submissionId} />
          </>
        )}
      </div>
    </article>
  );
}

/** The uploaded photo, fetched with the signed-in token. Raw photos are deleted after 90 days. */
function Photo({ submissionId }: { submissionId: string }) {
  const { live, getToken } = useSession();
  const [state, setState] = useState<{ urls: string[]; note: string } | null>(
    null,
  );
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show || !live) return;
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const token = await getToken();
      const sub = await api.getSubmission(token, submissionId);
      for (const path of sub.fileUrls ?? []) {
        const res = await fetch(`${API_URL}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 410) throw new ApiError(410, "PHOTO_EXPIRED");
        if (!res.ok)
          throw new ApiError(res.status, "The photo could not be loaded.");
        made.push(URL.createObjectURL(await res.blob()));
      }
      if (!cancelled)
        setState({
          urls: made,
          note: made.length ? "" : "No photo is stored for this upload.",
        });
    })().catch((err: unknown) => {
      if (cancelled) return;
      const expired = err instanceof ApiError && err.status === 410;
      setState({
        urls: [],
        note: expired
          ? "This photo was deleted after 90 days, as our privacy policy promises."
          : "The photo could not be loaded.",
      });
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [show, live, getToken, submissionId]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <ImageIcon className="h-4 w-4" aria-hidden /> Your photo
        </h4>
        {live && (
          <button
            onClick={() => setShow((v) => !v)}
            className="btn btn-sm btn-secondary"
          >
            {show ? "Hide photo" : "Show photo"}
          </button>
        )}
      </div>
      {!live ? (
        <p className="text-sm text-slate-500">Sample data has no photo.</p>
      ) : show && state === null ? (
        <p className="text-sm text-slate-500" role="status">
          Loading the photo…
        </p>
      ) : show && state ? (
        state.urls.length ? (
          <div className="grid gap-3">
            {state.urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u}
                src={u}
                alt={`Uploaded page ${i + 1}`}
                className="w-full rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">{state.note}</p>
        )
      ) : null}
      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Names, emails and phone numbers are blurred before the photo is stored,
        location data is removed, and the photo is deleted after 90 days.
      </p>
    </div>
  );
}
