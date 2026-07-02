"use client";

import { useState } from "react";
import {
  useAddManualSession,
  useDeleteSession,
  useStartTimer,
  useStopTimer,
  useTaskSessions,
} from "@/lib/queries/sessions";
import {
  useDeleteTask,
  useUpdateTask,
  type Task,
} from "@/lib/queries/tasks";
import { PRIORITIES, PRIORITY_ORDER, type TaskPriority } from "@/lib/stats";
import { formatDuration } from "@/lib/time";

const inputCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskRow({
  task,
  projectId,
  totalSeconds,
  isTimerActive,
}: {
  task: Task;
  projectId: string;
  totalSeconds: number;
  isTimerActive: boolean;
}) {
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const [expanded, setExpanded] = useState(false);

  // edit form state (seeded when expanding)
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [estimate, setEstimate] = useState(
    task.estimate_minutes ? String(task.estimate_minutes) : ""
  );

  // manual time state
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDate, setManualDate] = useState(today());
  const [manualNote, setManualNote] = useState("");
  const addManual = useAddManualSession(task.id);
  const deleteSession = useDeleteSession(task.id);
  const { data: sessions } = useTaskSessions(task.id, expanded);

  const done = task.status === "done";

  function toggleDone() {
    updateTask.mutate(
      done
        ? { id: task.id, status: "todo", completed_at: null }
        : { id: task.id, status: "done", completed_at: new Date().toISOString() }
    );
  }

  async function onToggleTimer() {
    if (isTimerActive) {
      const outcome = await stopTimer.mutateAsync();
      if (outcome === "discarded") {
        alert("Timer ran past 12 hours — session discarded.");
      }
    } else {
      await startTimer.mutateAsync(task.id);
    }
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    updateTask.mutate({
      id: task.id,
      title: title.trim() || task.title,
      notes: notes.trim() || null,
      priority,
      estimate_minutes: estimate ? Math.max(1, parseInt(estimate, 10)) : null,
    });
    setExpanded(false);
  }

  function addManualTime(e: React.FormEvent) {
    e.preventDefault();
    const minutes = parseInt(manualMinutes, 10);
    if (!minutes || minutes < 1) return;
    addManual.mutate({ minutes, date: manualDate, note: manualNote.trim() });
    setManualMinutes("");
    setManualNote("");
  }

  return (
    <li className="rounded-lg border border-edge bg-panel">
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={done}
          onChange={toggleDone}
          className="size-4 shrink-0 accent-[#7fd4e4]"
          aria-label={done ? "Mark as not done" : "Mark as done"}
        />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className={done ? "text-muted line-through" : ""}>
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span style={{ color: PRIORITIES[task.priority].color }}>
              ● {PRIORITIES[task.priority].label}
            </span>
            {task.status === "in_progress" && !done && (
              <span className="text-accent">in progress</span>
            )}
            {totalSeconds > 0 && <span>{formatDuration(totalSeconds)}</span>}
            {task.estimate_minutes && (
              <span>est {formatDuration(task.estimate_minutes * 60)}</span>
            )}
          </span>
        </button>
        {!done && (
          <button
            onClick={onToggleTimer}
            disabled={startTimer.isPending || stopTimer.isPending}
            className={`shrink-0 rounded border px-2.5 py-1 text-sm transition-colors disabled:opacity-50 ${
              isTimerActive
                ? "border-danger/60 text-danger hover:bg-danger/10"
                : "border-accent/40 text-accent hover:bg-accent/10"
            }`}
          >
            {isTimerActive ? "■ Stop" : "▶ Start"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-edge p-3">
          <form onSubmit={saveEdit} className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              aria-label="Title"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={2}
              className={inputCls}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
                aria-label="Priority"
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITIES[p].label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="Estimate (min)"
                className="w-32 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete task "${task.title}" and its time log?`))
                    deleteTask.mutate(task.id);
                }}
                className="ml-auto rounded border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          </form>

          <form onSubmit={addManualTime} className="flex flex-wrap gap-2">
            <input
              type="number"
              min={1}
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              placeholder="Minutes"
              className="w-28 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
            />
            <input
              type="date"
              value={manualDate}
              max={today()}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
            />
            <input
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Note (optional)"
              className="min-w-32 flex-1 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
            >
              + Log time
            </button>
          </form>

          {sessions && sessions.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span>{new Date(s.started_at).toLocaleDateString()}</span>
                  <span className="text-fg">
                    {formatDuration(
                      (new Date(s.ended_at!).getTime() -
                        new Date(s.started_at).getTime()) /
                        1000
                    )}
                  </span>
                  <span>{s.source === "manual" ? "logged" : "timer"}</span>
                  {s.note && <span className="truncate">— {s.note}</span>}
                  <button
                    onClick={() => deleteSession.mutate(s.id)}
                    className="ml-auto text-danger/70 hover:text-danger"
                    aria-label="Delete session"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
