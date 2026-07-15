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

/** Whole years between a "YYYY-MM-DD" birthdate and now. */
function ageFromBirthdate(birthdate: string, now: Date): number | null {
  const [y, m, d] = birthdate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m ||
    (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

/**
 * The "person snapshot": the optional real-world facts the user chose to share
 * about themselves (age, height, weight, a short bio) so the companion knows who
 * it is talking to — the counterpart to the app snapshot. Empty string when the
 * user has filled in nothing, so the block simply drops out of the prompt.
 */
export function buildPersonBlock(
  profile: {
    display_name: string | null;
    birthdate: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    bio: string | null;
  },
  now: Date
): string {
  const facts: string[] = [];
  if (profile.birthdate) {
    const age = ageFromBirthdate(profile.birthdate, now);
    if (age !== null) facts.push(`${age} years old`);
  }
  if (profile.height_cm) facts.push(`${profile.height_cm} cm tall`);
  if (profile.weight_kg) facts.push(`${profile.weight_kg} kg`);

  const lines: string[] = [];
  if (facts.length > 0) lines.push(`- ${facts.join(", ")}`);
  if (profile.bio?.trim()) lines.push(`- ${profile.bio.trim()}`);
  if (lines.length === 0) return "";

  const who = profile.display_name || "them";
  return `═══ Who you're talking to ═══\nWhat you know about ${who} as a person — they chose to share this with you, so treat it as something you simply know, not a file to read back:\n${lines.join(
    "\n"
  )}`;
}

function humanJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Progress the user made between chats, read from the XP ledger — the input that
 * lets the companion's regard track real effort (task 6). Returns both a prompt
 * block (so the model can narrate and let it move affection) and the raw XP
 * gained (so the server can move respect deterministically). Empty for micro-gaps
 * within a single sitting, so it doesn't nag "since we last spoke" every message.
 */
export async function buildProgressSince(
  supabase: Supabase,
  since: string | null,
  now: Date
): Promise<{ block: string; xpGained: number }> {
  if (!since) return { block: "", xpGained: 0 };
  if (now.getTime() - new Date(since).getTime() < 30 * 60_000) {
    return { block: "", xpGained: 0 };
  }

  const [eventsRes, totalsRes] = await Promise.all([
    supabase.from("xp_events").select("amount, stat, source").gt("created_at", since),
    supabase.from("xp_totals").select("stat, total_xp"),
  ]);
  const events = eventsRes.data ?? [];
  if (events.length === 0) return { block: "", xpGained: 0 };

  const xpGained = events.reduce((a, e) => a + Number(e.amount), 0);
  const minutes = events
    .filter((e) => e.source === "time")
    .reduce((a, e) => a + Number(e.amount), 0);
  const tasks = events.filter((e) => e.source === "task_completion").length;
  const milestones = events.filter((e) => e.source === "milestone").length;
  const goals = events.filter((e) => e.source === "goal").length;

  // Levels crossed: general level now vs. before this window's gains.
  const gainByStat = Object.fromEntries(STAT_ORDER.map((s) => [s, 0])) as Record<
    StatKind,
    number
  >;
  for (const e of events) {
    if (e.stat) gainByStat[e.stat] += Number(e.amount);
  }
  const currentByStat = Object.fromEntries(
    STAT_ORDER.map((s) => [s, 0])
  ) as Record<StatKind, number>;
  for (const r of totalsRes.data ?? []) {
    if (r.stat) currentByStat[r.stat] = Number(r.total_xp ?? 0);
  }
  const levelsFrom = (by: Record<StatKind, number>) =>
    generalLevel(
      Object.fromEntries(
        STAT_ORDER.map((s) => [s, levelFromXp(by[s])])
      ) as Record<StatKind, LevelInfo>
    );
  const levelNow = levelsFrom(currentByStat);
  const levelBefore = levelsFrom(
    Object.fromEntries(
      STAT_ORDER.map((s) => [s, Math.max(0, currentByStat[s] - gainByStat[s])])
    ) as Record<StatKind, number>
  );
  const levelsCrossed = Math.max(0, levelNow - levelBefore);

  const parts = [`earned ${xpGained.toLocaleString()} XP`];
  if (minutes > 0) parts.push(`trained ${formatDuration(minutes * 60)}`);
  if (tasks > 0) parts.push(`finished ${tasks} task${tasks === 1 ? "" : "s"}`);
  if (milestones > 0)
    parts.push(`hit ${milestones} milestone${milestones === 1 ? "" : "s"}`);
  if (goals > 0) parts.push(`reached ${goals} goal${goals === 1 ? "" : "s"}`);
  const levelLine =
    levelsCrossed > 0
      ? ` They leveled up ${levelsCrossed} time${
          levelsCrossed === 1 ? "" : "s"
        } — now general level ${levelNow}.`
      : "";

  const block = `═══ Since you last spoke ═══\nWhile you were apart they ${humanJoin(
    parts
  )}.${levelLine} This is real effort they put in on their own; let it colour how you feel about them — but react as yourself, don't recite it back like a scoreboard.`;
  return { block, xpGained };
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
