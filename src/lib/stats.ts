import type { Enums } from "@/lib/supabase/types";

export type StatKind = Enums<"stat_kind">;
export type TaskPriority = Enums<"task_priority">;
export type TaskStatus = Enums<"task_status">;

export const STAT_ORDER: StatKind[] = [
  "strength",
  "vitality",
  "intelligence",
  "discipline",
  "creativity",
  "social",
];

export const STATS: Record<
  StatKind,
  { label: string; glyph: string; color: string }
> = {
  strength: { label: "Strength", glyph: "⚔", color: "#d4735f" },
  vitality: { label: "Vitality", glyph: "❁", color: "#7fc79a" },
  intelligence: { label: "Intelligence", glyph: "✦", color: "#7fa8e4" },
  discipline: { label: "Discipline", glyph: "▣", color: "#a58fd4" },
  creativity: { label: "Creativity", glyph: "✹", color: "#c9a86a" },
  social: { label: "Social", glyph: "☍", color: "#d48fb8" },
};

export const PRIORITY_ORDER: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const PRIORITIES: Record<TaskPriority, { label: string; color: string }> =
  {
    low: { label: "Low", color: "#66738f" },
    medium: { label: "Medium", color: "#7fa8e4" },
    high: { label: "High", color: "#c9a86a" },
    urgent: { label: "Urgent", color: "#d4735f" },
  };

export const STATUSES: Record<TaskStatus, { label: string }> = {
  todo: { label: "To do" },
  in_progress: { label: "In progress" },
  done: { label: "Done" },
};
