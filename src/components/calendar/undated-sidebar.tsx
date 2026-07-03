"use client";

import { useScheduleTask, useUndatedTasks } from "@/lib/queries/calendar";
import { useProjects } from "@/lib/queries/projects";
import { PRIORITIES, STATS } from "@/lib/stats";

export default function UndatedSidebar() {
  const { data: tasks } = useUndatedTasks();
  const { data: projects } = useProjects();
  const scheduleTask = useScheduleTask();
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <aside className="shrink-0 lg:w-64">
      <h2 className="text-xs uppercase tracking-widest text-muted">
        Undated tasks
      </h2>
      <p className="mt-1 text-[11px] text-muted">
        Drag onto a day, or pick a date.
      </p>
      <ul className="mt-2 space-y-1.5">
        {tasks?.map((t) => {
          const p = projectById.get(t.project_id);
          return (
            <li
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              className="cursor-grab rounded border border-edge bg-panel p-2 active:cursor-grabbing"
            >
              <span className="block truncate text-sm">{t.title}</span>
              <span className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                {p && (
                  <span className="truncate" style={{ color: STATS[p.stat].color }}>
                    {STATS[p.stat].glyph} {p.name}
                  </span>
                )}
                <span
                  className="shrink-0"
                  style={{ color: PRIORITIES[t.priority].color }}
                >
                  ● {PRIORITIES[t.priority].label}
                </span>
                <input
                  type="date"
                  onChange={(e) => {
                    if (e.target.value)
                      scheduleTask.mutate({ id: t.id, date: e.target.value });
                  }}
                  className="ml-auto shrink-0 rounded border border-edge bg-panel-2 px-1 py-0.5 text-muted outline-none focus:border-accent"
                  aria-label={`Schedule "${t.title}"`}
                />
              </span>
            </li>
          );
        })}
        {tasks && tasks.length === 0 && (
          <li className="text-xs text-muted">
            Nothing here — every open task has a date.
          </li>
        )}
      </ul>
    </aside>
  );
}
