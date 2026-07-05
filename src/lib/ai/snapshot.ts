import type { SupabaseClient } from "@supabase/supabase-js";
import { occurrencesByDay } from "@/lib/recurrence";
import { STAT_ORDER, STATS, type StatKind } from "@/lib/stats";
import type { Database } from "@/lib/supabase/types";
import { formatDuration } from "@/lib/time";
import { generalLevel, levelFromXp, type LevelInfo } from "@/lib/xp";

const MAX_PROJECTS = 8;
const MAX_GOALS = 6;
const MAX_UPCOMING = 5;

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
 * formatted summary built server-side from the same tables the UI reads —
 * today's standing plus projects, open goals and the week ahead. Every line is
 * capped so the block stays small in the prompt's dynamic tail.
 */
export async function buildAppSnapshot(
  supabase: Supabase,
  userName: string,
  now: Date,
  tzOffsetMinutes: number
): Promise<string> {
  const today = localDateStr(now, tzOffsetMinutes);
  const midnight = localMidnightUtc(today, tzOffsetMinutes).toISOString();

  const [xpRes, sessionsRes, activeRes, tasksRes, completionsRes, projectsRes, goalsRes, projectTimeRes] =
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
      supabase
        .from("projects")
        .select("id, name, stat, no_xp")
        .is("archived_at", null)
        .order("position")
        .order("created_at"),
      supabase
        .from("goals")
        .select("title, project_id, deadline, milestones(completed_at)")
        .is("completed_at", null)
        .order("created_at"),
      supabase.from("project_time_totals").select("project_id, total_seconds"),
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

  // projects (what areas of life they track, with tracked time)
  const projects = projectsRes.data ?? [];
  const timeByProject = new Map(
    (projectTimeRes.data ?? []).map((r) => [r.project_id, r.total_seconds ?? 0])
  );
  if (projects.length > 0) {
    const parts = projects.slice(0, MAX_PROJECTS).map((p) => {
      const secs = timeByProject.get(p.id) ?? 0;
      const details = [
        STATS[p.stat].label,
        secs > 0 ? `${formatDuration(secs)} tracked` : null,
        p.no_xp ? "casual, no XP" : null,
      ].filter(Boolean);
      return `"${p.name}" (${details.join(", ")})`;
    });
    lines.push(
      `- Projects: ${parts.join("; ")}${projects.length > MAX_PROJECTS ? "; …" : ""}`
    );
  }

  // open goals with milestone progress
  const goals = goalsRes.data ?? [];
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  if (goals.length > 0) {
    const parts = goals.slice(0, MAX_GOALS).map((g) => {
      const total = g.milestones.length;
      const done = g.milestones.filter((m) => m.completed_at !== null).length;
      const progress = total > 0 ? `${done}/${total} milestones` : "no milestones yet";
      const where = projectName.get(g.project_id);
      return `"${g.title}" (${progress}${where ? `, in ${where}` : ""})`;
    });
    lines.push(
      `- Open goals: ${parts.join("; ")}${goals.length > MAX_GOALS ? "; …" : ""}`
    );
  }

  // the week ahead: scheduled occurrences over the next 7 days + undated backlog
  if (tasksRes.data) {
    const weekDays: string[] = [];
    for (let i = 1; i <= 7; i++) {
      weekDays.push(
        localDateStr(new Date(now.getTime() + i * 86_400_000), tzOffsetMinutes)
      );
    }
    const byDay = occurrencesByDay(tasksRes.data, [], weekDays);
    const upcoming: string[] = [];
    let upcomingTotal = 0;
    for (const day of weekDays) {
      for (const occ of byDay.get(day) ?? []) {
        if (occ.completed) continue;
        upcomingTotal++;
        if (upcoming.length < MAX_UPCOMING) {
          const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString(
            "en-US",
            { weekday: "short", timeZone: "UTC" }
          );
          upcoming.push(`"${occ.task.title}" ${weekday}`);
        }
      }
    }
    if (upcomingTotal > 0) {
      lines.push(
        `- Next 7 days: ${upcomingTotal} scheduled (${upcoming.join(", ")}${upcomingTotal > MAX_UPCOMING ? ", …" : ""})`
      );
    }
    const backlog = tasksRes.data.filter(
      (t) => !t.recurrence && !t.scheduled_date && t.status !== "done"
    ).length;
    if (backlog > 0) {
      lines.push(`- Backlog: ${backlog} open task${backlog === 1 ? "" : "s"} without a date`);
    }
  }

  return `═══ ${userName || "The user"}'s current standing in Astrameath ═══\n${lines.join("\n")}`;
}
