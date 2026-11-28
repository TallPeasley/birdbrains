'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import CurriculumPicker from '@/components/CurriculumPicker';
import { api, ApiError } from '@/lib/api';
import { DEFAULT_COURSE, parseCourse } from '@/lib/curricula';
import { useSession } from '@/lib/session';

/** A student's course (curriculum, grade, subject), with a way to change it. */
export default function CourseSetting({ course, name, live }: { course: string | null; name: string; live: boolean }) {
  const { getToken, refreshProfile } = useSession();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(course ?? DEFAULT_COURSE);
  const [shown, setShown] = useState(course);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const info = parseCourse(shown);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (live) {
        await api.updateProfile(await getToken(), name, draft);
        await refreshProfile();
      }
      setShown(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your course. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">{info ? info.label : shown ?? 'Not set'}</p>
          {info && <p className="text-xs text-slate-500">{info.curriculum.name}</p>}
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-indigo-700 hover:underline">
            Change
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-3">
          <CurriculumPicker value={draft} onChange={setDraft} gradableOnly />
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save course
            </button>
            <button type="button" onClick={() => { setDraft(shown ?? DEFAULT_COURSE); setEditing(false); }} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
