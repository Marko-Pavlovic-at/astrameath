"use client";

import { useState } from "react";
import { parseDateStr, todayStr } from "@/lib/dates";
import { useToggleCompletion } from "@/lib/queries/calendar";
import {
  useAddManualSession,
  useDeleteSession,
  useStartTimer,
  useStopTimer,
  useTaskSessions,
} from "@/lib/queries/sessions";
import {
  useCreateSubtask,
  useDeleteSubtask,
  useDeleteTask,
  useSetSubtaskCompleted,
  useUpdateTask,
  type Task,
} from "@/lib/queries/tasks";
import { describeRecurrence, parseRecurrence } from "@/lib/recurrence";
import { PRIORITIES, PRIORITY_ORDER, type TaskPriority } from "@/lib/stats";
import type { Json } from "@/lib/supabase/types";
import { formatDuration } from "@/lib/time";

const inputCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

type Freq = "none" | "daily" | "weekly" | "monthly";

// Mon-first display order; values are JS getDay() (0 = Sun)
const WEEKDAY_OPTS: Array<{ label: string; value: number }> = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function TaskRow({
  task,
  projectId,
  totalSeconds,
  isTimerActive,
  completedToday,
}: {
  task: Task;
  projectId: string;
  totalSeconds: number;
  isTimerActive: boolean;
  completedToday: boolean;
}) {
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const createSubtask = useCreateSubtask(projectId);
  const setSubtaskCompleted = useSetSubtaskCompleted(projectId);
  const deleteSubtask = useDeleteSubtask(projectId);
  const toggleCompletion = useToggleCompletion();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const subtasks = task.subtasks;
  const subDone = subtasks.filter((s) => s.completed_at !== null).length;
  const subPct = subtasks.length > 0 ? (subDone / subtasks.length) * 100 : 0;

  const recurrence = parseRecurrence(task.recurrence);
  const isRecurring = recurrence !== null;

  const [expanded, setExpanded] = useState(false);

  // edit form state (seeded when expanding)
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [estimate, setEstimate] = useState(
    task.estimate_minutes ? String(task.estimate_minutes) : ""
  );
  const [schedDate, setSchedDate] = useState(task.scheduled_date ?? "");
  const [schedTime, setSchedTime] = useState(
    task.scheduled_time?.slice(0, 5) ?? ""
  );
  const [freq, setFreq] = useState<Freq>(recurrence?.freq ?? "none");
  const [weeklyDays, setWeeklyDays] = useState<number[]>(
    recurrence?.freq === "weekly" ? recurrence.days : []
  );
  const [monthlyDay, setMonthlyDay] = useState(
    recurrence?.freq === "monthly" ? String(recurrence.day) : "1"
  );

  // subtask add state
  const [newSubtask, setNewSubtask] = useState("");

  // manual time state
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDate, setManualDate] = useState(todayStr());
  const [manualNote, setManualNote] = useState("");
  const addManual = useAddManualSession(task.id);
  const deleteSession = useDeleteSession();
  const { data: sessions } = useTaskSessions(task.id, expanded);

  const done = task.status === "done";
  // recurring templates are never "done" — the checkbox drives today's occurrence
  const checked = isRecurring ? completedToday : done;

  function toggleDone() {
    if (isRecurring) {
      toggleCompletion.mutate({
        taskId: task.id,
        date: todayStr(),
        completed: !completedToday,
      });
      return;
    }
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
    let newRecurrence: Json | null = null;
    if (freq === "daily") {
      newRecurrence = { freq: "daily" };
    } else if (freq === "weekly") {
      if (weeklyDays.length === 0) {
        alert("Pick at least one weekday for a weekly task.");
        return;
      }
      newRecurrence = { freq: "weekly", days: [...weeklyDays].sort() };
    } else if (freq === "monthly") {
      newRecurrence = {
        freq: "monthly",
        day: Math.min(31, Math.max(1, parseInt(monthlyDay, 10) || 1)),
      };
    }
    updateTask.mutate({
      id: task.id,
      title: title.trim() || task.title,
      notes: notes.trim() || null,
      priority,
      estimate_minutes: estimate ? Math.max(1, parseInt(estimate, 10)) : null,
      scheduled_date: schedDate || null,
      scheduled_time: schedTime || null,
      recurrence: newRecurrence,
    });
    setExpanded(false);
  }

  function toggleWeekday(day: number) {
    setWeeklyDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    );
  }

  function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() });
    setNewSubtask("");
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
      <div className="flex items-center gap-1 p-3 sm:gap-3">
        {/* padding on the label, not the box: ~40px touch target, 20px visual */}
        <label className="-m-1 flex shrink-0 cursor-pointer items-center p-2.5 sm:p-1.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={toggleDone}
            className="size-5 accent-[#7fd4e4] sm:size-4"
            aria-label={
              isRecurring
                ? checked
                  ? "Mark today as not done"
                  : "Mark today as done"
                : checked
                  ? "Mark as not done"
                  : "Mark as done"
            }
          />
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className={checked ? "text-muted line-through" : ""}>
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span style={{ color: PRIORITIES[task.priority].color }}>
              ● {PRIORITIES[task.priority].label}
            </span>
            {recurrence && (
              <span className="text-accent">
                ↻ {describeRecurrence(recurrence)}
              </span>
            )}
            {!recurrence && task.scheduled_date && (
              <span>
                📅{" "}
                {parseDateStr(task.scheduled_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {task.scheduled_time && ` ${task.scheduled_time.slice(0, 5)}`}
              </span>
            )}
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
            className={`inline-flex min-h-11 shrink-0 items-center rounded border px-3 text-sm transition-colors disabled:opacity-50 sm:min-h-0 sm:px-2.5 sm:py-1 ${
              isTimerActive
                ? "border-danger/60 text-danger hover:bg-danger/10"
                : "border-accent/40 text-accent hover:bg-accent/10"
            }`}
          >
            {isTimerActive ? "■ Stop" : "▶ Start"}
          </button>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${subPct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {Math.round(subPct)}%
          </span>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 border-t border-edge p-3">
          {/* Subtasks lead the panel — the checklist is what you open a task for. */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-muted">
              Subtasks
            </h3>
            {subtasks.map((s) => {
              const sDone = s.completed_at !== null;
              return (
                <div key={s.id} className="flex items-center gap-1 sm:gap-3">
                  <label className="-m-1 flex shrink-0 cursor-pointer items-center p-2.5 sm:p-1.5">
                    <input
                      type="checkbox"
                      checked={sDone}
                      onChange={() =>
                        setSubtaskCompleted.mutate({ id: s.id, completed: !sDone })
                      }
                      className="size-5 accent-[#7fd4e4] sm:size-3.5"
                      aria-label={
                        sDone ? "Mark subtask not done" : "Mark subtask done"
                      }
                    />
                  </label>
                  <span
                    className={`min-w-0 flex-1 text-sm ${sDone ? "text-muted line-through" : ""}`}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask.mutate(s.id)}
                    className="-m-1 flex size-10 shrink-0 items-center justify-center text-xs text-danger/60 hover:text-danger sm:size-6"
                    aria-label="Delete subtask"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <form onSubmit={addSubtask} className="flex flex-wrap gap-2 pt-1">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Subtask…"
                className="min-w-32 flex-1 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
              >
                + Add
              </button>
            </form>
          </div>

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
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
                aria-label="Scheduled date"
              />
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
                aria-label="Time of day"
              />
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value as Freq)}
                className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
                aria-label="Repeats"
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {freq === "monthly" && (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  on day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={monthlyDay}
                    onChange={(e) => setMonthlyDay(e.target.value)}
                    className="w-16 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
                  />
                </label>
              )}
            </div>
            {freq === "weekly" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTS.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => toggleWeekday(d.value)}
                    className={`rounded border px-2 py-1 text-xs transition-colors ${
                      weeklyDays.includes(d.value)
                        ? "border-accent/40 text-accent"
                        : "border-edge text-muted hover:text-fg"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
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
              max={todayStr()}
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
                    className="-m-1 ml-auto flex size-9 shrink-0 items-center justify-center text-danger/70 hover:text-danger sm:size-6"
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
