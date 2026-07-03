"use client";

import { useState } from "react";
import {
  useActiveSession,
  useStartTimer,
  useStopTimer,
} from "@/lib/queries/sessions";
import type { Occurrence } from "@/lib/recurrence";
import { PRIORITIES } from "@/lib/stats";

export default function DayView({
  date,
  occs,
  meta,
  onToggle,
  onDropTask,
}: {
  date: string;
  occs: Occurrence[];
  meta: Record<string, { name: string; color: string; glyph: string }>;
  onToggle: (occ: Occurrence) => void;
  onDropTask: (date: string, taskId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const { data: activeSession } = useActiveSession();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  async function toggleTimer(taskId: string) {
    if (activeSession?.task_id === taskId) {
      const outcome = await stopTimer.mutateAsync();
      if (outcome === "discarded") {
        alert("Timer ran past 12 hours — session discarded.");
      }
    } else {
      await startTimer.mutateAsync(taskId);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropTask(date, id);
      }}
      className={`min-h-48 rounded border p-2 transition-colors ${
        over ? "border-accent bg-accent/10" : "border-transparent"
      }`}
    >
      {occs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing scheduled — drag an undated task here.
        </p>
      ) : (
        <ul className="space-y-2">
          {occs.map((occ) => {
            const m = meta[occ.task.project_id];
            const time = occ.task.scheduled_time?.slice(0, 5);
            const isTimerActive = activeSession?.task_id === occ.task.id;
            return (
              <li
                key={`${occ.task.id}-${occ.date}`}
                className="flex items-center gap-3 rounded-lg border border-edge bg-panel p-3"
              >
                <input
                  type="checkbox"
                  checked={occ.completed}
                  onChange={() => onToggle(occ)}
                  className="size-4 shrink-0 accent-[#7fd4e4]"
                  aria-label={`Mark "${occ.task.title}" ${occ.completed ? "not done" : "done"}`}
                />
                <div className="min-w-0 flex-1">
                  <span className={occ.completed ? "text-muted line-through" : ""}>
                    {occ.task.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    {m && (
                      <span style={{ color: m.color }}>
                        {m.glyph} {m.name}
                      </span>
                    )}
                    <span style={{ color: PRIORITIES[occ.task.priority].color }}>
                      ● {PRIORITIES[occ.task.priority].label}
                    </span>
                    {occ.recurring && <span className="text-accent">↻ recurring</span>}
                  </span>
                </div>
                {time && <span className="shrink-0 text-sm text-muted">{time}</span>}
                {!occ.completed && (
                  <button
                    onClick={() => toggleTimer(occ.task.id)}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
