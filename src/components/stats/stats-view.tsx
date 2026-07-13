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
  dayTotals,
  projectTotals,
  sessionDate,
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
    // sessions of archived/unknown projects fold into one null bucket
    const inRange = sessions
      .filter((s) => {
        const d = sessionDate(s);
        return d >= start && d <= today;
      })
      .map((s) =>
        s.projectId && projectById.has(s.projectId)
          ? s
          : { ...s, projectId: null }
      );

    const days = dayTotals(inRange, start, today);
    const weekly = days.length > WEEKLY_THRESHOLD_DAYS;
    return {
      projectById,
      days,
      weekly,
      buckets: weekly ? weeklyTotals(days) : days,
      byProject: projectTotals(inRange),
    };
  }, [sessions, projects, range, today]);

  if (!derived) return <p className="text-sm text-muted">Loading…</p>;
  const { projectById, days, weekly, buckets, byProject } = derived;

  const total = days.reduce((acc, d) => acc + d.seconds, 0);
  const daysElapsed = days.length;
  const activeDays = days.filter((d) => d.seconds > 0).length;
  const best = days.reduce((a, b) => (b.seconds > a.seconds ? b : a), days[0]);
  const maxBucket = Math.max(...buckets.map((b) => b.seconds), 1);
  const maxProject = byProject[0]?.seconds ?? 0;
  const bucketLabel = weekly ? weekLabel : dayLabel;

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

      {/* headline numbers */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Tracked"
          value={formatDuration(total)}
          sub={`across ${daysElapsed} day${daysElapsed === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Avg / day"
          value={formatDuration(total / daysElapsed)}
          sub={
            activeDays > 0
              ? `${formatDuration(total / activeDays)} per active day`
              : "no active days yet"
          }
        />
        <StatTile
          label="Active days"
          value={`${activeDays} / ${daysElapsed}`}
          sub={`${Math.round((activeDays / daysElapsed) * 100)}% of days`}
        />
        <StatTile
          label="Best day"
          value={best.seconds > 0 ? formatDuration(best.seconds) : "—"}
          sub={best.seconds > 0 ? dayLabel(best.date) : "nothing tracked yet"}
        />
      </div>

      {/* activity over time */}
      <div className="mt-6 rounded-lg border border-edge bg-panel p-4">
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

      {/* per-project distribution */}
      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Distribution
        </h2>
        {byProject.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No time tracked in this range yet — start a timer on any task and
            the stats fill in.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {byProject.map((row) => {
              const project = row.projectId
                ? projectById.get(row.projectId)
                : undefined;
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
                        <span
                          aria-hidden
                          style={{ color: STATS[project.stat].color }}
                        >
                          {STATS[project.stat].glyph}
                        </span>{" "}
                        {project.name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm text-muted">
                        Archived projects
                      </span>
                    )}
                    <span className="shrink-0 text-sm">
                      {formatDuration(row.seconds)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-panel-2">
                    <div
                      className="h-full rounded bg-accent"
                      style={{
                        width: `${(row.seconds / maxProject) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {Math.round((row.seconds / total) * 100)}% of tracked ·
                    active {row.activeDays} of {daysElapsed} days ·{" "}
                    {formatDuration(row.seconds / row.activeDays)} per active
                    day
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
    </div>
  );
}
