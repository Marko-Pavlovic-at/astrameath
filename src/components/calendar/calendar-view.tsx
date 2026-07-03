"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import DayView from "@/components/calendar/day-view";
import MonthGrid from "@/components/calendar/month-grid";
import UndatedSidebar from "@/components/calendar/undated-sidebar";
import WeekGrid from "@/components/calendar/week-grid";
import {
  addDays,
  addMonths,
  monthGrid,
  parseDateStr,
  startOfWeek,
  todayStr,
} from "@/lib/dates";
import {
  useCalendarTasks,
  useCompletions,
  useScheduleTask,
  useSetTaskDone,
  useToggleCompletion,
} from "@/lib/queries/calendar";
import { useProjects } from "@/lib/queries/projects";
import { occurrencesByDay, type Occurrence } from "@/lib/recurrence";
import { STATS } from "@/lib/stats";

type View = "month" | "week" | "day";

const VIEWS: Array<{ value: View; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

const emptySubscribe = () => () => {};

export default function CalendarView() {
  // "today" resolves only after hydration so the server render never bakes in
  // its own timezone's date (SSR runs in the server's TZ, not the user's).
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const today = hydrated ? todayStr() : null;
  const [cursorOverride, setCursor] = useState<string | null>(null);
  const cursor = cursorOverride ?? today ?? "";
  const [view, setView] = useState<View>("month");

  const weeks = useMemo(() => (cursor ? monthGrid(cursor) : []), [cursor]);

  const days = useMemo(() => {
    if (!cursor) return [];
    if (view === "month") return weeks.flat();
    if (view === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [cursor];
  }, [cursor, view, weeks]);

  const rangeStart = days[0] ?? "";
  const rangeEnd = days[days.length - 1] ?? "";
  const ready = days.length > 0;

  const { data: tasks } = useCalendarTasks(rangeStart, rangeEnd, ready);
  const { data: completions } = useCompletions(rangeStart, rangeEnd, ready);
  const { data: projects } = useProjects();

  const scheduleTask = useScheduleTask();
  const toggleCompletion = useToggleCompletion();
  const setTaskDone = useSetTaskDone();

  const occurrences = useMemo(
    () => occurrencesByDay(tasks ?? [], completions ?? [], days),
    [tasks, completions, days]
  );

  const projectMeta = useMemo(() => {
    const map: Record<string, { name: string; color: string; glyph: string }> = {};
    for (const p of projects ?? []) {
      map[p.id] = {
        name: p.name,
        color: STATS[p.stat].color,
        glyph: STATS[p.stat].glyph,
      };
    }
    return map;
  }, [projects]);

  const colors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, m] of Object.entries(projectMeta)) map[id] = m.color;
    return map;
  }, [projectMeta]);

  if (!today || !ready) {
    return (
      <section>
        <h1 className="text-xl uppercase tracking-widest">Calendar</h1>
        <p className="mt-3 text-sm text-muted">Loading…</p>
      </section>
    );
  }

  function navigate(dir: -1 | 1) {
    if (view === "month") setCursor(addMonths(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(addDays(cursor, dir));
  }

  function selectDay(date: string) {
    setCursor(date);
    setView("day");
  }

  function dropTask(date: string, taskId: string) {
    scheduleTask.mutate({ id: taskId, date });
  }

  function toggleOccurrence(occ: Occurrence) {
    if (occ.recurring) {
      toggleCompletion.mutate({
        taskId: occ.task.id,
        date: occ.date,
        completed: !occ.completed,
      });
    } else {
      setTaskDone.mutate({ id: occ.task.id, done: !occ.completed });
    }
  }

  function title(): string {
    const d = parseDateStr(cursor);
    if (view === "month")
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const s = parseDateStr(rangeStart);
      const e = parseDateStr(rangeEnd);
      return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl uppercase tracking-widest">Calendar</h1>
        <div className="ml-auto flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                view === v.value
                  ? "border-accent/40 text-accent"
                  : "border-edge text-muted hover:text-fg"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        <button
          onClick={() => navigate(-1)}
          aria-label="Previous"
          className="rounded border border-edge px-2.5 py-1 text-sm text-muted hover:text-fg"
        >
          ‹
        </button>
        <button
          onClick={() => setCursor(today)}
          className="rounded border border-edge px-2.5 py-1 text-xs text-muted hover:text-fg"
        >
          Today
        </button>
        <button
          onClick={() => navigate(1)}
          aria-label="Next"
          className="rounded border border-edge px-2.5 py-1 text-sm text-muted hover:text-fg"
        >
          ›
        </button>
        <span className="ml-2 text-sm">{title()}</span>
      </div>

      <div className="mt-4 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          {view === "month" && (
            <MonthGrid
              weeks={weeks}
              monthOf={cursor}
              today={today}
              occurrences={occurrences}
              colors={colors}
              onSelectDay={selectDay}
              onDropTask={dropTask}
            />
          )}
          {view === "week" && (
            <WeekGrid
              days={days}
              today={today}
              occurrences={occurrences}
              colors={colors}
              onSelectDay={selectDay}
              onDropTask={dropTask}
              onToggle={toggleOccurrence}
            />
          )}
          {view === "day" && (
            <DayView
              date={cursor}
              occs={occurrences.get(cursor) ?? []}
              meta={projectMeta}
              onToggle={toggleOccurrence}
              onDropTask={dropTask}
            />
          )}
        </div>
        <UndatedSidebar />
      </div>
    </section>
  );
}
