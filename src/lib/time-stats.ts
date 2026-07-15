/**
 * Pure aggregation helpers for the stats page. A session is attributed
 * entirely to its local start date (sessions are ≤12h, so at worst a
 * late-night session credits yesterday — good enough, and consistent).
 */

import { addDays, startOfWeek, toDateStr } from "@/lib/dates";

export type StatsSession = {
  startedAt: string;
  endedAt: string;
  projectId: string | null;
};

export function sessionSeconds(s: StatsSession): number {
  return Math.max(
    0,
    (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000
  );
}

export function sessionDate(s: StatsSession): string {
  return toDateStr(new Date(s.startedAt));
}

export type DayTotal = { date: string; seconds: number };

/** Zero-filled per-day totals covering [start, end] inclusive. */
export function dayTotals(
  sessions: StatsSession[],
  start: string,
  end: string
): DayTotal[] {
  const map = new Map<string, number>();
  for (let d = start; d <= end; d = addDays(d, 1)) map.set(d, 0);
  for (const s of sessions) {
    const date = sessionDate(s);
    const prev = map.get(date);
    if (prev !== undefined) map.set(date, prev + sessionSeconds(s));
  }
  return [...map.entries()].map(([date, seconds]) => ({ date, seconds }));
}

/** Mon-start weekly buckets — the chart falls back to these on long ranges. */
export function weeklyTotals(days: DayTotal[]): DayTotal[] {
  const map = new Map<string, number>();
  for (const d of days) {
    const week = startOfWeek(d.date);
    map.set(week, (map.get(week) ?? 0) + d.seconds);
  }
  return [...map.entries()].map(([date, seconds]) => ({ date, seconds }));
}

export type ProjectTotal = {
  projectId: string | null; // null = session whose project no longer resolves
  seconds: number;
  activeDays: number;
};

/**
 * Current and longest active-day streaks from the set of dates that had any
 * tracked time. "Current" counts back from today, or from yesterday when today
 * has nothing yet — so it doesn't read 0 first thing in the morning. Computed
 * over all history, not a range (a streak is a global property).
 */
export function activeDayStreaks(
  activeDates: Set<string>,
  today: string
): { current: number; longest: number } {
  const sorted = [...activeDates].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  let current = 0;
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  while (activeDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

/** Per-project time + distinct active days, sorted most-tracked first. */
export function projectTotals(sessions: StatsSession[]): ProjectTotal[] {
  const map = new Map<string | null, { seconds: number; days: Set<string> }>();
  for (const s of sessions) {
    let agg = map.get(s.projectId);
    if (!agg) {
      agg = { seconds: 0, days: new Set() };
      map.set(s.projectId, agg);
    }
    agg.seconds += sessionSeconds(s);
    agg.days.add(sessionDate(s));
  }
  return [...map.entries()]
    .map(([projectId, { seconds, days }]) => ({
      projectId,
      seconds,
      activeDays: days.size,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}
