"use client";

import { useState } from "react";
import { todayStr } from "@/lib/dates";
import {
  useAddProjectSession,
  useDeleteSession,
  useProjectSessions,
  useUpdateSession,
  type ProjectSession,
} from "@/lib/queries/sessions";
import { formatDuration } from "@/lib/time";

const fieldCls =
  "min-h-11 rounded border border-edge bg-panel-2 px-2 text-fg outline-none focus:border-accent sm:min-h-0 sm:py-1.5";

function sessionMinutes(s: ProjectSession): number {
  return Math.round(
    (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000
  );
}

/** yyyy-mm-dd of a session's local start date. */
function sessionDate(s: ProjectSession): string {
  const d = new Date(s.started_at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SOURCE_LABEL: Record<string, string> = {
  timer: "timer",
  manual: "logged",
  import: "imported",
};

/**
 * Project-level time log: list every finished session under the project (task or
 * not), add manual/imported time, and correct or delete a mis-tracked entry —
 * without hunting down the task it hangs on. Imported hours carry a badge and,
 * per the XP trigger, never award XP.
 */
export default function ProjectTimePanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const { data: sessions } = useProjectSessions(projectId, open);
  const addSession = useAddProjectSession(projectId);
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"manual" | "import">("manual");

  const [editingId, setEditingId] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const mins = parseInt(minutes, 10);
    if (!mins || mins < 1) return;
    addSession.mutate(
      { minutes: mins, date, note: note.trim(), source },
      {
        onSuccess: () => {
          setMinutes("");
          setNote("");
        },
      }
    );
  }

  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm text-muted hover:text-fg"
        aria-expanded={open}
      >
        <span aria-hidden className="text-xs">
          {open ? "▾" : "▸"}
        </span>
        Time log
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-lg border border-edge bg-panel p-3">
          <form onSubmit={add} className="space-y-2">
            <div className="flex gap-2">
              {(["manual", "import"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSource(s)}
                  className={`min-h-11 flex-1 rounded border px-3 text-sm transition-colors sm:min-h-0 sm:py-1.5 ${
                    source === s
                      ? "border-accent/40 text-accent"
                      : "border-edge text-muted hover:text-fg"
                  }`}
                >
                  {s === "manual" ? "Log time" : "Import (no XP)"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Minutes"
                className={`w-28 ${fieldCls}`}
                aria-label="Minutes"
              />
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className={fieldCls}
                aria-label="Date"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className={`min-w-32 flex-1 ${fieldCls}`}
              />
              <button
                type="submit"
                disabled={addSession.isPending}
                className="min-h-11 rounded border border-accent/40 px-4 text-sm text-accent hover:bg-accent/10 disabled:opacity-50 sm:min-h-0 sm:py-1.5"
              >
                Add
              </button>
            </div>
            {source === "import" && (
              <p className="text-xs text-muted">
                Backfilled from another app — counts toward totals and stats, but
                awards no XP.
              </p>
            )}
          </form>

          {sessions && sessions.length > 0 ? (
            <ul className="space-y-1.5">
              {sessions.map((s) =>
                editingId === s.id ? (
                  <EditRow
                    key={s.id}
                    session={s}
                    onCancel={() => setEditingId(null)}
                    onSave={(patch) =>
                      updateSession.mutate(
                        { id: s.id, ...patch },
                        { onSuccess: () => setEditingId(null) }
                      )
                    }
                  />
                ) : (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
                  >
                    <span className="tabular-nums">{sessionDate(s)}</span>
                    <span className="text-fg">
                      {formatDuration(sessionMinutes(s) * 60)}
                    </span>
                    <span className="truncate">
                      {s.tasks?.title ?? "— project"}
                    </span>
                    <span
                      className={`rounded border px-1 text-[10px] uppercase tracking-wider ${
                        s.source === "import"
                          ? "border-gold/40 text-gold"
                          : "border-edge"
                      }`}
                    >
                      {SOURCE_LABEL[s.source]}
                    </span>
                    {s.note && <span className="truncate">— {s.note}</span>}
                    <span className="ml-auto flex items-center">
                      <button
                        onClick={() => setEditingId(s.id)}
                        className="-m-1 flex size-9 items-center justify-center text-muted hover:text-fg sm:size-6"
                        aria-label="Edit session"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteSession.mutate(s.id)}
                        className="-m-1 flex size-9 items-center justify-center text-danger/70 hover:text-danger sm:size-6"
                        aria-label="Delete session"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted">No time logged for this project yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Inline editor: change duration/date/note. Keeps the original start time-of-day. */
function EditRow({
  session,
  onCancel,
  onSave,
}: {
  session: ProjectSession;
  onCancel: () => void;
  onSave: (patch: {
    started_at: string;
    ended_at: string;
    note: string | null;
  }) => void;
}) {
  const [minutes, setMinutes] = useState(String(sessionMinutes(session)));
  const [date, setDate] = useState(sessionDate(session));
  const [note, setNote] = useState(session.note ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    const mins = Math.max(1, parseInt(minutes, 10) || 1);
    // preserve the original clock time, re-home it on the (possibly new) date
    const orig = new Date(session.started_at);
    const start = new Date(
      `${date}T${String(orig.getHours()).padStart(2, "0")}:${String(
        orig.getMinutes()
      ).padStart(2, "0")}:${String(orig.getSeconds()).padStart(2, "0")}`
    );
    const end = new Date(start.getTime() + mins * 60_000);
    onSave({
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      note: note.trim() || null,
    });
  }

  return (
    <li>
      <form
        onSubmit={save}
        className="flex flex-wrap items-center gap-2 rounded border border-accent/30 bg-panel-2 p-2"
      >
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className={`w-24 ${fieldCls}`}
          aria-label="Minutes"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldCls}
          aria-label="Date"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          className={`min-w-28 flex-1 ${fieldCls}`}
        />
        <button
          type="submit"
          className="min-h-11 rounded border border-accent/40 px-3 text-xs text-accent hover:bg-accent/10 sm:min-h-0 sm:py-1.5"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded border border-edge px-3 text-xs text-muted hover:text-fg sm:min-h-0 sm:py-1.5"
        >
          Cancel
        </button>
      </form>
    </li>
  );
}
