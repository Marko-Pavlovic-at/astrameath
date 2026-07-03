import type { SupabaseClient } from "@supabase/supabase-js";
import { occurrencesByDay } from "@/lib/recurrence";
import { STAT_ORDER, type StatKind } from "@/lib/stats";
import type { Database } from "@/lib/supabase/types";
import { formatDuration } from "@/lib/time";
import { generalLevel, levelFromXp, type LevelInfo } from "@/lib/xp";

type Supabase = SupabaseClient<Database>;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" of an instant in the user's timezone. */
function localDateStr(at: Date, tzOffsetMinutes: number): string {
  const local = new Date(at.getTime() + tzOffsetMinutes * 60_000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** UTC instant of local midnight for the given local date. */
function localMidnightUtc(dateStr: string, tzOffsetMinutes: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - tzOffsetMinutes * 60_000);
}

/**
 * The companion's only window into the app (it has no tool access): a compact
 * formatted summary of today's standing, built server-side from the same
 * tables the UI reads.
 */
export async function buildAppSnapshot(
  supabase: Supabase,
  userName: string,
  now: Date,
  tzOffsetMinutes: number
): Promise<string> {
  const today = localDateStr(now, tzOffsetMinutes);
  const midnight = localMidnightUtc(today, tzOffsetMinutes).toISOString();

  const [xpRes, sessionsRes, activeRes, tasksRes, completionsRes] =
    await Promise.all([
      supabase.from("xp_totals").select("*"),
      supabase
        .from("time_sessions")
        .select("started_at, ended_at")
        .gte("started_at", midnight)
        .not("ended_at", "is", null),
      supabase
        .from("time_sessions")
        .select("started_at, tasks(title)")
        .is("ended_at", null)
        .maybeSingle(),
      supabase.from("tasks").select("*"),
      supabase.from("task_completions").select("task_id, date").eq("date", today),
    ]);

  const lines: string[] = [];

  // level + XP
  if (xpRes.data) {
    const xp = Object.fromEntries(STAT_ORDER.map((s) => [s, 0])) as Record<
      StatKind,
      number
    >;
    for (const row of xpRes.data) {
      if (row.stat) xp[row.stat] = Number(row.total_xp ?? 0);
    }
    const statLevels = Object.fromEntries(
      STAT_ORDER.map((s) => [s, levelFromXp(xp[s])])
    ) as Record<StatKind, LevelInfo>;
    const total = STAT_ORDER.reduce((acc, s) => acc + xp[s], 0);
    lines.push(
      `- General level ${generalLevel(statLevels)} (${total.toLocaleString()} XP lifetime)`
    );
  }

  // time tracked today
  const trackedSeconds = (sessionsRes.data ?? []).reduce(
    (acc, s) =>
      acc +
      Math.max(
        0,
        (new Date(s.ended_at as string).getTime() -
          new Date(s.started_at).getTime()) /
          1000
      ),
    0
  );
  lines.push(
    trackedSeconds > 0
      ? `- Time trained today: ${formatDuration(trackedSeconds)}`
      : "- No time tracked yet today"
  );

  // running timer
  if (activeRes.data) {
    const mins = Math.round(
      (now.getTime() - new Date(activeRes.data.started_at).getTime()) / 60_000
    );
    lines.push(
      `- Right now they are working on "${activeRes.data.tasks?.title ?? "a task"}" (timer running, ${mins}m in)`
    );
  }

  // today's tasks (one-offs + recurring occurrences)
  if (tasksRes.data) {
    const occurrences =
      occurrencesByDay(tasksRes.data, completionsRes.data ?? [], [today]).get(
        today
      ) ?? [];
    const done = occurrences.filter((o) => o.completed);
    const open = occurrences.filter((o) => !o.completed);
    const offScheduleDone = (tasksRes.data ?? []).filter(
      (t) =>
        t.completed_at &&
        t.completed_at >= midnight &&
        !occurrences.some((o) => o.task.id === t.id)
    ).length;
    const doneCount = done.length + offScheduleDone;
    if (doneCount > 0 || open.length > 0) {
      const openTitles = open
        .slice(0, 3)
        .map((o) => `"${o.task.title}"`)
        .join(", ");
      lines.push(
        `- Tasks today: ${doneCount} done, ${open.length} still open${
          open.length > 0 ? ` (${openTitles}${open.length > 3 ? ", …" : ""})` : ""
        }`
      );
    }
  }

  return `═══ ${userName || "The user"}'s current standing in Astrameath ═══\n${lines.join("\n")}`;
}
