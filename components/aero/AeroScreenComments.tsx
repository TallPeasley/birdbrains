'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, Trash2, X } from 'lucide-react';

interface ScreenComment {
  id: string;
  path: string;
  text: string;
  createdAt: string;
}

const STORAGE_KEY = 'aero_screen_comments_v1';

export default function AeroScreenComments() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<ScreenComment[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setComments(JSON.parse(raw) as ScreenComment[]);
    } catch {
      // ignore storage errors
    }
  }, []);

  function saveComments(next: ScreenComment[]) {
    setComments(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const item: ScreenComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      path: pathname,
      text,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    saveComments([item, ...comments]);
    setDraft('');
  }

  function handleDelete(id: string) {
    saveComments(comments.filter((c) => c.id !== id));
  }

  const visible = showAll
    ? comments
    : comments.filter((c) => c.path === pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-lg hover:bg-slate-50"
        aria-label="Open screen comments"
      >
        <MessageSquarePlus className="h-4 w-4 text-indigo-600" />
        Comments ({visible.length})
      </button>

      {open ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Screen Comments</h2>
              <p className="font-mono text-[11px] text-slate-500">{pathname}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                {showAll ? 'This Screen' : 'All Screens'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close comments"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {visible.length === 0 ? (
              <p className="text-xs text-slate-500">
                No comments on {showAll ? 'any screen' : pathname} yet.
              </p>
            ) : (
              visible.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{c.path}</span>
                    <div className="flex items-center gap-2">
                      <span>{c.createdAt}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{c.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAdd} className="border-t border-slate-200 p-3 space-y-2">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Add a comment on ${pathname}...`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Post Comment
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
