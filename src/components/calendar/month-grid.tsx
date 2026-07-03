"use client";

import { useState } from "react";
import TaskChip from "@/components/calendar/task-chip";
import { WEEKDAYS } from "@/lib/dates";
import type { Occurrence } from "@/lib/recurrence";

const MAX_CHIPS = 3;

export default function MonthGrid({
  weeks,
  monthOf,
  today,
  occurrences,
  colors,
  onSelectDay,
  onDropTask,
}: {
  weeks: string[][];
  monthOf: string; // any date inside the displayed month
  today: string;
  occurrences: Map<string, Occurrence[]>;
  colors: Record<string, string>;
  onSelectDay: (date: string) => void;
  onDropTask: (date: string, taskId: string) => void;
}) {
  const month = monthOf.slice(0, 7);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => (
          <DayCell
            key={date}
            date={date}
            inMonth={date.slice(0, 7) === month}
            isToday={date === today}
            occs={occurrences.get(date) ?? []}
            colors={colors}
            onSelectDay={onSelectDay}
            onDropTask={onDropTask}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  occs,
  colors,
  onSelectDay,
  onDropTask,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  occs: Occurrence[];
  colors: Record<string, string>;
  onSelectDay: (date: string) => void;
  onDropTask: (date: string, taskId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const extra = occs.length - MAX_CHIPS;
  return (
    <div
      onClick={() => onSelectDay(date)}
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
      className={`min-h-20 cursor-pointer rounded border p-1 transition-colors sm:min-h-24 ${
        over ? "border-accent bg-accent/10" : "border-edge bg-panel hover:bg-panel-2"
      } ${inMonth ? "" : "opacity-40"}`}
    >
      <span
        className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${
          isToday ? "bg-accent/20 text-accent" : "text-muted"
        }`}
      >
        {Number(date.slice(8))}
      </span>
      <div className="mt-0.5 space-y-0.5">
        {occs.slice(0, MAX_CHIPS).map((occ) => (
          <TaskChip
            key={`${occ.task.id}-${occ.date}`}
            occ={occ}
            color={colors[occ.task.project_id]}
          />
        ))}
        {extra > 0 && (
          <span className="block px-1 text-[10px] text-muted">+{extra} more</span>
        )}
      </div>
    </div>
  );
}
