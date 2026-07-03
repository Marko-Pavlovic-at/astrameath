import type { StatKind } from "@/lib/stats";

/**
 * Level curve — pure, derive-only (hard rule: levels are never stored, so this
 * can be retuned freely without migrations). XP award amounts live in the DB
 * triggers (supabase/migrations/20260703_xp_triggers.sql); documented here so
 * the UI can explain them.
 */
export const XP_RATES = {
  perMinute: 1,
  taskCompletion: 10,
  milestone: 25,
  goal: 50,
} as const;

/** XP needed to go from `level` to `level + 1` — linear growth, quadratic total. */
export function levelUpCost(level: number): number {
  return 100 + (level - 1) * 50;
}

export type LevelInfo = {
  level: number;
  /** XP accumulated inside the current level. */
  intoLevel: number;
  /** Total XP the current level requires to complete. */
  toNext: number;
};

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, totalXp);
  while (rest >= levelUpCost(level)) {
    rest -= levelUpCost(level);
    level++;
  }
  return { level, intoLevel: rest, toNext: levelUpCost(level) };
}

/**
 * General level composes the six stat levels: starts at 1, and every stat
 * level gained anywhere raises it by one.
 */
export function generalLevel(statLevels: Record<StatKind, LevelInfo>): number {
  const sum = Object.values(statLevels).reduce((acc, s) => acc + s.level, 0);
  return sum - Object.keys(statLevels).length + 1;
}
