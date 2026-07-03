/**
 * Reward catalog — what unlocks at which *general* level. Lives in code, not
 * the DB (plan §2): availability is derived from the level at read time, so
 * the catalog can grow or move without touching data. The `unlocks` table is
 * reserved for future rewards that aren't purely level-based.
 *
 * Theme keys map to accent overrides in globals.css (`[data-theme=...]`).
 */

export type RewardKind = "title" | "item" | "theme";

export type Reward = {
  kind: RewardKind;
  key: string;
  label: string;
  glyph: string;
  level: number;
  blurb: string;
};

export const REWARDS: Reward[] = [
  // titles
  { kind: "title", key: "novice", label: "Novice", glyph: "○", level: 1, blurb: "Everyone starts somewhere." },
  { kind: "title", key: "wanderer", label: "Wanderer", glyph: "☄", level: 3, blurb: "The first steps of the ascent." },
  { kind: "title", key: "adept", label: "Adept", glyph: "✧", level: 6, blurb: "Practice is becoming habit." },
  { kind: "title", key: "pathfinder", label: "Pathfinder", glyph: "✦", level: 10, blurb: "You chart your own course." },
  { kind: "title", key: "ascendant", label: "Ascendant", glyph: "▲", level: 15, blurb: "The climb defines you." },
  { kind: "title", key: "voidwalker", label: "Voidwalker", glyph: "☽", level: 21, blurb: "Beyond the visible sky." },
  { kind: "title", key: "starforged", label: "Starforged", glyph: "✹", level: 28, blurb: "Made of burning discipline." },
  { kind: "title", key: "lightbearer", label: "Lightbearer", glyph: "✴", level: 36, blurb: "Others navigate by you now." },
  { kind: "title", key: "celestine", label: "Celestine", glyph: "❂", level: 45, blurb: "Half habit, half constellation." },
  { kind: "title", key: "dawnbringer", label: "Dawnbringer", glyph: "☀", level: 55, blurb: "Every morning answers to you." },
  { kind: "title", key: "eclipse-sovereign", label: "Eclipse Sovereign", glyph: "◐", level: 66, blurb: "You rule both light and rest." },
  { kind: "title", key: "worldshaper", label: "Worldshaper", glyph: "❖", level: 78, blurb: "Your hours became a world." },
  { kind: "title", key: "transcendent", label: "Transcendent", glyph: "✺", level: 90, blurb: "Past every ceiling you were given." },
  { kind: "title", key: "astrameath", label: "Astrameath", glyph: "✵", level: 100, blurb: "The summit has a name — yours." },

  // items (cosmetic trophies)
  { kind: "item", key: "ember-sigil", label: "Ember Sigil", glyph: "🜂", level: 2, blurb: "A spark that refused to die." },
  { kind: "item", key: "lunar-charm", label: "Lunar Charm", glyph: "☾", level: 5, blurb: "Keeps late-night focus honest." },
  { kind: "item", key: "astral-compass", label: "Astral Compass", glyph: "✵", level: 8, blurb: "Always points at what matters." },
  { kind: "item", key: "phoenix-plume", label: "Phoenix Plume", glyph: "🜁", level: 12, blurb: "For streaks reborn from ashes." },
  { kind: "item", key: "crown-of-echoes", label: "Crown of Echoes", glyph: "♕", level: 18, blurb: "Every tracked hour, remembered." },
  { kind: "item", key: "worldheart-shard", label: "Worldheart Shard", glyph: "❖", level: 25, blurb: "A fragment of the summit." },

  // themes (accent palettes; applied via data-theme)
  { kind: "theme", key: "abyss", label: "Abyss", glyph: "◆", level: 1, blurb: "The default deep-sea calm." },
  { kind: "theme", key: "ember", label: "Ember", glyph: "◆", level: 4, blurb: "Warm forge-light accent." },
  { kind: "theme", key: "verdant", label: "Verdant", glyph: "◆", level: 7, blurb: "Growth in every corner." },
  { kind: "theme", key: "aurum", label: "Aurum", glyph: "◆", level: 11, blurb: "Gilded for the patient." },
  { kind: "theme", key: "rosequartz", label: "Rose Quartz", glyph: "◆", level: 16, blurb: "Soft light for hard work." },
];

/** Accent color previews for theme swatches (mirror globals.css). */
export const THEME_ACCENTS: Record<string, string> = {
  abyss: "#7fd4e4",
  ember: "#e4a37f",
  verdant: "#8fd49a",
  aurum: "#e4c97f",
  rosequartz: "#e49fc0",
};

export function rewardsOfKind(kind: RewardKind): Reward[] {
  return REWARDS.filter((r) => r.kind === kind).sort((a, b) => a.level - b.level);
}

export function isUnlocked(reward: Reward, level: number): boolean {
  return level >= reward.level;
}
