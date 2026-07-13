"use client";

import { useState } from "react";
import DangerZone from "@/components/profile/danger-zone";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";
import { useXpTotals } from "@/lib/queries/xp";
import {
  isUnlocked,
  rewardsOfKind,
  THEME_ACCENTS,
  type Reward,
  type RewardKind,
} from "@/lib/rewards";
import { STAT_ORDER, STATS, type StatKind } from "@/lib/stats";
import {
  generalLevel,
  levelFromXp,
  nextGeneralLevelUp,
  XP_RATES,
  type LevelInfo,
} from "@/lib/xp";

export default function ProfileView() {
  const { data: profile } = useProfile();
  const { data: xp } = useXpTotals();
  const updateProfile = useUpdateProfile();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  if (!profile || !xp) return <p className="text-sm text-muted">Loading…</p>;

  const statLevels = Object.fromEntries(
    STAT_ORDER.map((s) => [s, levelFromXp(xp[s])])
  ) as Record<StatKind, LevelInfo>;
  const level = generalLevel(statLevels);
  const totalXp = STAT_ORDER.reduce((acc, s) => acc + xp[s], 0);
  const next = nextGeneralLevelUp(statLevels);

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) updateProfile.mutate({ display_name: trimmed });
    setEditingName(false);
  }

  function pick(reward: Reward) {
    if (!isUnlocked(reward, level)) return;
    if (reward.kind === "title") {
      updateProfile.mutate({
        active_title: profile!.active_title === reward.key ? null : reward.key,
      });
    } else if (reward.kind === "theme") {
      updateProfile.mutate({ active_theme: reward.key });
    }
  }

  const activeTitle = rewardsOfKind("title").find(
    (r) => r.key === profile.active_title
  );

  return (
    <section className="mx-auto max-w-3xl">
      {/* identity */}
      <div className="flex flex-wrap items-baseline gap-x-3">
        {editingName ? (
          <form onSubmit={saveName} className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-fg outline-none focus:border-accent"
              aria-label="Display name"
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setName(profile.display_name ?? "");
              setEditingName(true);
            }}
            className="inline-flex min-h-11 items-center text-xl hover:text-accent sm:min-h-0"
            title="Edit name"
          >
            {profile.display_name ?? "Unnamed"}
          </button>
        )}
        {activeTitle && (
          <span className="text-sm text-gold">
            {activeTitle.glyph} {activeTitle.label}
          </span>
        )}
      </div>

      {/* general level */}
      <div className="mt-4 flex items-center gap-5 rounded-lg border border-edge bg-panel p-5">
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-2 border-accent/50 bg-panel-2">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Level
          </span>
          <span className="text-2xl text-accent">{level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {totalXp.toLocaleString()} XP across all stats
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-panel-2">
            <div
              className="h-full rounded bg-accent transition-[width]"
              style={{
                width: `${Math.round((next.intoLevel / next.toNext) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs">
            Level {level + 1} in{" "}
            <span className="text-accent">{next.remaining} XP</span> — closest
            path via{" "}
            <span style={{ color: STATS[next.stat].color }}>
              {STATS[next.stat].glyph} {STATS[next.stat].label}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Every stat level gained raises the general level by one. Earn XP by
            tracking time ({XP_RATES.perMinute}/min), completing tasks (+
            {XP_RATES.taskCompletion}), milestones (+{XP_RATES.milestone}) and
            goals (+{XP_RATES.goal}).
          </p>
        </div>
      </div>

      {/* stat levels */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAT_ORDER.map((s) => {
          const info = statLevels[s];
          const pct = Math.round((info.intoLevel / info.toNext) * 100);
          return (
            <div key={s} className="rounded-lg border border-edge bg-panel p-3">
              <p className="flex items-baseline justify-between text-sm">
                <span style={{ color: STATS[s].color }}>
                  {STATS[s].glyph} {STATS[s].label}
                </span>
                <span className="text-fg">Lv {info.level}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-panel-2">
                <div
                  className="h-full rounded transition-[width]"
                  style={{ width: `${pct}%`, background: STATS[s].color }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                {info.intoLevel} / {info.toNext} · {xp[s].toLocaleString()} XP
                total
              </p>
            </div>
          );
        })}
      </div>

      {/* rewards */}
      {(["title", "item", "theme"] as RewardKind[]).map((kind) => (
        <div key={kind} className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            {kind === "title" ? "Titles" : kind === "item" ? "Items" : "Themes"}
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            {kind === "title"
              ? "Unlocked by general level — click one to wear it."
              : kind === "item"
                ? "Trophies of the ascent."
                : "Accent palettes — click to apply."}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rewardsOfKind(kind).map((r) => {
              const unlocked = isUnlocked(r, level);
              const active =
                (kind === "title" && profile.active_title === r.key) ||
                (kind === "theme" &&
                  (profile.active_theme ?? "abyss") === r.key);
              const selectable = unlocked && kind !== "item";
              return (
                <li key={r.key}>
                  <button
                    onClick={() => pick(r)}
                    disabled={!selectable}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? "border-gold/60 bg-panel-2"
                        : unlocked
                          ? "border-edge bg-panel"
                          : "border-edge bg-panel opacity-40"
                    } ${selectable ? "hover:border-accent/50" : ""}`}
                  >
                    <p className="flex items-baseline justify-between text-sm">
                      <span className={unlocked ? "" : "text-muted"}>
                        <span
                          aria-hidden
                          style={
                            kind === "theme"
                              ? { color: THEME_ACCENTS[r.key] }
                              : undefined
                          }
                        >
                          {r.glyph}
                        </span>{" "}
                        {r.label}
                      </span>
                      {active ? (
                        <span className="text-[10px] uppercase text-gold">
                          active
                        </span>
                      ) : (
                        !unlocked && (
                          <span className="text-[10px] text-muted">
                            Lv {r.level}
                          </span>
                        )
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {unlocked ? r.blurb : "Locked"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <DangerZone />
    </section>
  );
}
