"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  parseDateStr,
  startOfMonth,
  startOfWeek,
  todayStr,
} from "@/lib/dates";
import { useProjects } from "@/lib/queries/projects";
import { useStatsSessions } from "@/lib/queries/stats";
import { STATS } from "@/lib/stats";
import { formatDuration } from "@/lib/time";
import {
  activeDayStreaks,
  dayTotals,
  projectTotals,
  sessionDate,
  sessionSeconds,
  weeklyTotals,
  type DayTotal,
} from "@/lib/time-stats";

const RANGES = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** Daily charts get unreadable past ~6 weeks; bucket by week instead. */
const WEEKLY_THRESHOLD_DAYS = 42;

function dayLabel(date: string): string {
  return parseDateStr(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function weekLabel(date: string): string {
  return `Week of ${parseDateStr(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function trendColor(pct: number) {
  return pct > 0 ? "#199e70" : "#d95926";
}

export default function StatsView() {
  const { data: sessions } = useStatsSessions();
  const { data: projects } = useProjects();
  const [range, setRange] = useState<RangeKey>("month");
  const [picked, setPicked] = useState<DayTotal | null>(null);

  const today = todayStr();

  const derived = useMemo(() => {
    if (!sessions || !projects) return null;

    const start =
      range === "week"
        ? startOfWeek(today)
        : range === "month"
          ? startOfMonth(today)
          : range === "30d"
            ? addDays(today, -29)
            : sessions.length
              ? sessionDate(sessions[0])
              : today;

    const projectById = new Map(projects.map((p) => [p.id, p]));
    // archived/unknown projects collapse to the null bucket
    const norm = (projectId: string | null) =>
      projectId && projectById.has(projectId) ? projectId : null;

    const inRange = sessions
      .filter((s) => {
        const d = sessionDate(s);
        return d >= start && d <= today;
      })
      .map((s) => ({ ...s, projectId: norm(s.projectId) }));

    const days = dayTotals(inRange, start, today);
    const weekly = days.length > WEEKLY_THRESHOLD_DAYS;

    // Streaks are a per-project property over ALL history, not the range.
    const activeDatesByProject = new Map<string | null, Set<string>>();
    for (const s of sessions) {
      const pid = norm(s.projectId);
      let set = activeDatesByProject.get(pid);
      if (!set) {
        set = new Set();
        activeDatesByProject.set(pid, set);
      }
      set.add(sessionDate(s));
    }

    // Previous equal-length window → trend, global and per project (not for "all").
    const span = days.length;
    const prevStart = addDays(start, -span);
    const prevEnd = addDays(start, -1);
    const prevByProject = new Map<string | null, number>();
    let prevTotal = 0;
    if (range !== "all") {
      for (const s of sessions) {
        const d = sessionDate(s);
        if (d >= prevStart && d <= prevEnd) {
          const pid = norm(s.projectId);
          const sec = sessionSeconds(s);
          prevByProject.set(pid, (prevByProject.get(pid) ?? 0) + sec);
          prevTotal += sec;
        }
      }
    }

    const byProject = projectTotals(inRange).map((row) => {
      const streak = activeDayStreaks(
        activeDatesByProject.get(row.projectId) ?? new Set(),
        today
      );
      const prev = prevByProject.get(row.projectId) ?? 0;
      const trendPct =
        range !== "all" && prev > 0
          ? Math.round(((row.seconds - prev) / prev) * 100)
          : null;
      return { ...row, streak, trendPct };
    });

    return {
      projectById,
      days,
      weekly,
      buckets: weekly ? weeklyTotals(days) : days,
      byProject,
      prevTotal: range === "all" ? null : prevTotal,
    };
  }, [sessions, projects, range, today]);

  if (!derived) return <p className="text-sm text-muted">Loading…</p>;
  const { projectById, days, weekly, buckets, byProject, prevTotal } = derived;

  const total = days.reduce((acc, d) => acc + d.seconds, 0);
  const daysElapsed = days.length;
  const activeDays = days.filter((d) => d.seconds > 0).length;
  const maxBucket = Math.max(...buckets.map((b) => b.seconds), 1);
  const maxProject = byProject[0]?.seconds ?? 0;
  const bucketLabel = weekly ? weekLabel : dayLabel;
  const globalTrend =
    prevTotal && prevTotal > 0
      ? Math.round(((total - prevTotal) / prevTotal) * 100)
      : null;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl uppercase tracking-widest">Stats</h1>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setRange(r.key);
                setPicked(null);
              }}
              className={`inline-flex min-h-11 items-center rounded border px-3 text-xs transition-colors sm:min-h-0 sm:px-2 sm:py-1 ${
                range === r.key
                  ? "border-accent/60 bg-panel-2 text-accent"
                  : "border-edge text-muted hover:border-accent/40 hover:text-fg"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* slim global summary */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-edge bg-panel px-4 py-3">
        <span className="flex items-baseline gap-2">
          <span className="text-xl">{formatDuration(total)}</span>
          {globalTrend != null && globalTrend !== 0 && (
            <span
              className="text-xs"
              style={{ color: trendColor(globalTrend) }}
            >
              {globalTrend > 0 ? "▲" : "▼"} {Math.abs(globalTrend)}%
            </span>
          )}
          <span className="text-[11px] text-muted">tracked</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xl">{formatDuration(total / daysElapsed)}</span>
          <span className="text-[11px] text-muted">avg / day</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xl">
            {activeDays}
            <span className="text-sm text-muted">/{daysElapsed}</span>
          </span>
          <span className="text-[11px] text-muted">active days</span>
        </span>
      </div>

      {/* per-project — the focus of the page */}
      <div className="mt-6">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Per project
        </h2>
        {byProject.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No time tracked in this range yet — start a timer on any task and the
            stats fill in.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {byProject.map((row) => {
              const project = row.projectId
                ? projectById.get(row.projectId)
                : undefined;
              const color = project
                ? STATS[project.stat].color
                : "var(--color-muted)";
              return (
                <li
                  key={row.projectId ?? "archived"}
                  className="rounded-lg border border-edge bg-panel p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    {project ? (
                      <Link
                        href={`/projects/${project.id}`}
                        className="truncate text-sm hover:text-accent"
                      >
                        <span aria-hidden style={{ color }}>
                          {STATS[project.stat].glyph}
                        </span>{" "}
                        {project.name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm text-muted">
                        Archived projects
                      </span>
                    )}
                    <span className="flex shrink-0 items-baseline gap-2 text-sm">
                      {formatDuration(row.seconds)}
                      {row.trendPct != null && row.trendPct !== 0 && (
                        <span
                          className="text-xs"
                          style={{ color: trendColor(row.trendPct) }}
                        >
                          {row.trendPct > 0 ? "▲" : "▼"}
                          {Math.abs(row.trendPct)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-panel-2">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(row.seconds / maxProject) * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                    {row.streak.current > 0 ? (
                      <span>
                        <span aria-hidden>🔥</span>{" "}
                        <span className="text-fg">{row.streak.current}d</span>{" "}
                        streak
                      </span>
                    ) : (
                      <span>no active streak</span>
                    )}
                    <span className="text-edge">·</span>
                    <span>longest {row.streak.longest}d</span>
                    <span className="text-edge">·</span>
                    <span>
                      {Math.round((row.seconds / total) * 100)}% of range
                    </span>
                    <span className="text-edge">·</span>
                    <span>
                      active {row.activeDays}/{daysElapsed}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* when the time went in — supporting detail */}
      <div className="mt-8 rounded-lg border border-edge bg-panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            {weekly ? "Time per week" : "Time per day"}
          </h2>
          <p className="text-[11px] text-muted">
            {picked
              ? `${bucketLabel(picked.date)} · ${formatDuration(picked.seconds)}`
              : `peak ${formatDuration(maxBucket)}`}
          </p>
        </div>
        <div
          className={`mt-3 flex h-32 items-end border-b border-edge ${
            buckets.length <= 12 ? "gap-1.5" : "gap-px"
          }`}
          onMouseLeave={() => setPicked(null)}
        >
          {buckets.map((b) => (
            <button
              key={b.date}
              type="button"
              // touch has no hover: the tap has to set the readout itself
              onClick={() => setPicked((p) => (p?.date === b.date ? null : b))}
              onMouseEnter={() => setPicked(b)}
              onFocus={() => setPicked(b)}
              aria-label={`${bucketLabel(b.date)}: ${formatDuration(b.seconds)}`}
              className="flex h-full max-w-6 flex-1 items-end"
            >
              {b.seconds > 0 ? (
                <span
                  className={`block w-full rounded-t ${
                    picked?.date === b.date ? "bg-accent" : "bg-accent/70"
                  }`}
                  style={{
                    height: `${Math.max((b.seconds / maxBucket) * 100, 3)}%`,
                  }}
                />
              ) : (
                <span className="block h-0.5 w-full bg-panel-2" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted">
          <span>{bucketLabel(buckets[0].date)}</span>
          <span>
            {weekly ? bucketLabel(buckets[buckets.length - 1].date) : "Today"}
          </span>
        </div>
      </div>
    </section>
  );
}
