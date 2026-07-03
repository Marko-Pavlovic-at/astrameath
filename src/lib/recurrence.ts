import { parseDateStr, toDateStr } from "@/lib/dates";
import type { Task } from "@/lib/queries/tasks";
import type { Json } from "@/lib/supabase/types";

/**
 * Stored in tasks.recurrence (jsonb). A task with non-null recurrence is a
 * template: it is never "done" itself — per-day checks live in task_completions.
 */
export type Recurrence =
  | { freq: "daily" }
  | { freq: "weekly"; days: number[] } // JS getDay(): 0 = Sun … 6 = Sat
  | { freq: "monthly"; day: number }; // 1–31, clamps to shorter months

export function parseRecurrence(value: Json | null | undefined): Recurrence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, Json | undefined>;
  if (v.freq === "daily") return { freq: "daily" };
  if (v.freq === "weekly" && Array.isArray(v.days)) {
    const days = v.days.filter(
      (d): d is number => typeof d === "number" && d >= 0 && d <= 6
    );
    return days.length > 0 ? { freq: "weekly", days } : null;
  }
  if (v.freq === "monthly" && typeof v.day === "number" && v.day >= 1 && v.day <= 31) {
    return { freq: "monthly", day: v.day };
  }
  return null;
}

export function occursOn(rec: Recurrence, dateStr: string): boolean {
  const d = parseDateStr(dateStr);
  switch (rec.freq) {
    case "daily":
      return true;
    case "weekly":
      return rec.days.includes(d.getDay());
    case "monthly": {
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(rec.day, daysInMonth);
    }
  }
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(rec: Recurrence): string {
  switch (rec.freq) {
    case "daily":
      return "daily";
    case "weekly": {
      const ordered = [...rec.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return `weekly · ${ordered.map((d) => DAY_ABBR[d]).join(", ")}`;
    }
    case "monthly":
      return `monthly · day ${rec.day}`;
  }
}

export type Occurrence = {
  task: Task;
  date: string;
  recurring: boolean;
  completed: boolean;
};

/**
 * Expand tasks into per-day occurrences for the given days. Recurring templates
 * yield one occurrence per matching day from their anchor (scheduled_date, else
 * creation date) onward; one-off dated tasks land on their scheduled_date.
 */
export function occurrencesByDay(
  tasks: Task[],
  completions: Array<{ task_id: string; date: string }>,
  days: string[]
): Map<string, Occurrence[]> {
  const completedSet = new Set(completions.map((c) => `${c.task_id}|${c.date}`));
  const map = new Map<string, Occurrence[]>();
  for (const day of days) map.set(day, []);

  for (const task of tasks) {
    const rec = parseRecurrence(task.recurrence);
    if (rec) {
      const anchor = task.scheduled_date ?? toDateStr(new Date(task.created_at));
      for (const day of days) {
        if (day < anchor || !occursOn(rec, day)) continue;
        map.get(day)!.push({
          task,
          date: day,
          recurring: true,
          completed: completedSet.has(`${task.id}|${day}`),
        });
      }
    } else if (task.scheduled_date && map.has(task.scheduled_date)) {
      map.get(task.scheduled_date)!.push({
        task,
        date: task.scheduled_date,
        recurring: false,
        completed: task.status === "done",
      });
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const ta = a.task.scheduled_time ?? "99";
      const tb = b.task.scheduled_time ?? "99";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.task.created_at < b.task.created_at ? -1 : 1;
    });
  }
  return map;
}
