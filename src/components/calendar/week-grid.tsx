"use client";

import { useState } from "react";
import TaskChip from "@/components/calendar/task-chip";
import { parseDateStr, WEEKDAYS } from "@/lib/dates";
import type { Occurrence } from "@/lib/recurrence";

export default function WeekGrid({
  days,
  today,
  occurrences,
  colors,
  onSelectDay,
  onDropTask,
  onToggle,
}: {
  days: string[];
  today: string;
  occurrences: Map<string, Occurrence[]>;
  colors: Record<string, string>;
  onSelectDay: (date: string) => void;
  onDropTask: (date: string, taskId: string) => void;
  onToggle: (occ: Occurrence) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-1">
      {days.map((date, i) => (
        <DayColumn
          key={date}
          date={date}
          weekday={WEEKDAYS[i]}
          isToday={date === today}
          occs={occurrences.get(date) ?? []}
          colors={colors}
          onSelectDay={onSelectDay}
          onDropTask={onDropTask}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function DayColumn({
  date,
  weekday,
  isToday,
  occs,
  colors,
  onSelectDay,
  onDropTask,
  onToggle,
}: {
  date: string;
  weekday: string;
  isToday: boolean;
  occs: Occurrence[];
  colors: Record<string, string>;
  onSelectDay: (date: string) => void;
  onDropTask: (date: string, taskId: string) => void;
  onToggle: (occ: Occurrence) => void;
}) {
  const [over, setOver] = useState(false);
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
      className={`rounded border p-1.5 transition-colors sm:min-h-48 ${
        over ? "border-accent bg-accent/10" : "border-edge bg-panel"
      }`}
    >
      <button
        onClick={() => onSelectDay(date)}
        className={`flex w-full items-baseline gap-1.5 px-0.5 text-left text-xs sm:flex-col sm:gap-0 ${
          isToday ? "text-accent" : "text-muted"
        } hover:text-fg`}
      >
        <span className="uppercase tracking-wider">{weekday}</span>
        <span className="text-sm">{parseDateStr(date).getDate()}</span>
      </button>
      <div className="mt-1.5 space-y-1">
        {occs.map((occ) => (
          <TaskChip
            key={`${occ.task.id}-${occ.date}`}
            occ={occ}
            color={colors[occ.task.project_id]}
            showTime
            onToggle={() => onToggle(occ)}
          />
        ))}
      </div>
    </div>
  );
}
