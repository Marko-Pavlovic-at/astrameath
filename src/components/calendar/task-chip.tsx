"use client";

import type { Occurrence } from "@/lib/recurrence";

/**
 * Compact task pill for month/week cells. One-off tasks are draggable to
 * another day; recurring occurrences are not (their dates come from the rule).
 */
export default function TaskChip({
  occ,
  color,
  showTime = false,
  onToggle,
}: {
  occ: Occurrence;
  color?: string;
  showTime?: boolean;
  onToggle?: () => void;
}) {
  const time = occ.task.scheduled_time?.slice(0, 5);
  return (
    <div
      draggable={!occ.recurring}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/plain", occ.task.id);
      }}
      style={{ borderLeftColor: color ?? "transparent" }}
      className="flex items-center gap-1 rounded border-l-2 bg-panel-2 px-2 py-1 text-xs leading-tight sm:px-1 sm:py-0.5 sm:text-[10px]"
      title={occ.task.title}
    >
      {onToggle && (
        <label
          className="flex shrink-0 cursor-pointer items-center p-2.5 sm:p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={occ.completed}
            onChange={onToggle}
            className="size-5 accent-[#7fd4e4] sm:size-3"
            aria-label={`Mark "${occ.task.title}" ${occ.completed ? "not done" : "done"}`}
          />
        </label>
      )}
      {showTime && time && <span className="shrink-0 text-muted">{time}</span>}
      <span
        className={`truncate ${occ.completed ? "text-muted line-through" : ""}`}
      >
        {occ.recurring && <span aria-hidden>↻ </span>}
        {occ.task.title}
      </span>
    </div>
  );
}
