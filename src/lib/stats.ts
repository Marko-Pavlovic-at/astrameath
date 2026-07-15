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

// Categorical palette for the six stats. Redesigned in Stage 1.5 (task 7) to be
// CVD-safe as a set — the old colors failed as a categorical palette (Phase 5).
// Validated with the dataviz validator against the dark panel (#0c101b): all six
// sit in L 0.48–0.67, clear 3:1 contrast, and adjacent pairs in STAT_ORDER clear
// the CVD floor. The one floor-band pair (strength/vitality = red/green) is always
// mitigated by the glyph + label that accompany every stat colour in the UI.
export const STATS: Record<
  StatKind,
  { label: string; glyph: string; color: string }
> = {
  strength: { label: "Strength", glyph: "⚔", color: "#e66767" },
  vitality: { label: "Vitality", glyph: "❁", color: "#199e70" },
  intelligence: { label: "Intelligence", glyph: "✦", color: "#3987e5" },
  discipline: { label: "Discipline", glyph: "▣", color: "#d95926" },
  creativity: { label: "Creativity", glyph: "✹", color: "#9085e9" },
  social: { label: "Social", glyph: "☍", color: "#d55181" },
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
