import type { Json } from "@/lib/supabase/types";
import type { StateUpdate } from "@/lib/ai/tools";

/**
 * Relationship axes, 0–100 clamped. The archetype is derived at prompt-build
 * time, never stored (V1 rule: derive, don't persist).
 */
export type Relationship = {
  affection: number;
  trust: number;
  respect: number;
  amusement: number;
  annoyance: number;
};

export const AXES = [
  "affection",
  "trust",
  "respect",
  "amusement",
  "annoyance",
] as const;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function parseRelationship(value: Json | null | undefined): Relationship {
  const v =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Json | undefined>)
      : {};
  const num = (x: Json | undefined) => (typeof x === "number" ? clamp(x) : 0);
  return {
    affection: num(v.affection),
    trust: num(v.trust),
    respect: num(v.respect),
    amusement: num(v.amusement),
    annoyance: num(v.annoyance),
  };
}

export function applyDeltas(rel: Relationship, update: StateUpdate): Relationship {
  return {
    affection: clamp(rel.affection + update.affection_delta),
    trust: clamp(rel.trust + update.trust_delta),
    respect: clamp(rel.respect + update.respect_delta),
    amusement: clamp(rel.amusement + update.amusement_delta),
    annoyance: clamp(rel.annoyance + update.annoyance_delta),
  };
}

/**
 * Absence decay (V1 rule): affection and trust fade with days away; annoyance
 * cools off too. Respect drifts down gently — it is the one axis the grind can
 * push back up (see applyRespectGain), so a stretch away with no progress lets it
 * slip, while training during that same stretch offsets or overtakes the drift.
 * This is the SINGLE decay path — "slacking" is just an absence with no XP to show.
 * Applied when loading state before a turn.
 */
export function applyAbsenceDecay(
  rel: Relationship,
  lastSeenAt: string | null,
  now: Date
): { rel: Relationship; daysAway: number } {
  if (!lastSeenAt) return { rel, daysAway: 0 };
  const days = Math.floor(
    (now.getTime() - new Date(lastSeenAt).getTime()) / 86_400_000
  );
  if (days < 2) return { rel, daysAway: days };
  return {
    daysAway: days,
    rel: {
      ...rel,
      affection: clamp(rel.affection - Math.min(days, 15)),
      trust: clamp(rel.trust - Math.min(Math.floor(days / 2), 10)),
      respect: clamp(rel.respect - Math.min(Math.floor(days / 3), 8)),
      annoyance: clamp(rel.annoyance - Math.min(days * 2, 30)),
    },
  };
}

/**
 * XP earned since the last chat → respect. Deterministic and server-owned: the
 * companion's regard is *earned by real progress*, not by how the user talks to
 * it, and it cannot be farmed by chatting (chatting earns no XP). ~50 XP per
 * point, capped per turn so a single big session can't spike it. The model never
 * moves respect itself (its respect_delta is dropped) — it only narrates.
 */
export function respectGainFromXp(xpGained: number): number {
  if (xpGained <= 0) return 0;
  return Math.min(5, Math.floor(xpGained / 50));
}

export function applyRespectGain(
  rel: Relationship,
  xpGained: number
): Relationship {
  return { ...rel, respect: clamp(rel.respect + respectGainFromXp(xpGained)) };
}

/** Combine axes into an archetype label — derived, never stored. */
export function deriveArchetype(rel: Relationship): string {
  if (rel.annoyance > 70 && rel.affection < 30) return "adversary";
  if (rel.affection > 70 && rel.trust > 60) return "close confidant";
  if (rel.affection > 45 && rel.amusement > 60) return "playful friend";
  if (rel.respect > 70 && rel.trust > 50) return "trusted ally";
  if (rel.annoyance > 50) return "strained acquaintance";
  if (rel.affection > 40) return "friend";
  if (rel.affection > 15 || rel.respect > 25) return "acquaintance";
  return "stranger";
}

/**
 * Numbers → language (V1 lesson: models react to semantics far more reliably
 * than to raw numbers, so ship both).
 */
export function describeRelationship(
  rel: Relationship,
  userName: string
): string {
  const who = userName || "this person";
  const lines = [
    `Your relationship with ${who}: ${deriveArchetype(rel)}.`,
    `- Affection ${rel.affection}/100: ${
      rel.affection <= 15
        ? "you feel distant or indifferent."
        : rel.affection <= 40
          ? "you are warming up, but cautious."
          : rel.affection <= 70
            ? "you genuinely like them."
            : "you care deeply about them."
    }`,
    `- Trust ${rel.trust}/100: ${
      rel.trust <= 20
        ? "you keep your guard up around them."
        : rel.trust <= 55
          ? "you find them mostly honest."
          : "you trust their word."
    }`,
    `- Respect ${rel.respect}/100: ${
      rel.respect <= 20
        ? "they haven't shown you much worth respecting yet."
        : rel.respect <= 60
          ? "they've earned a measure of respect."
          : "you deeply respect what they do."
    }`,
    `- Amusement ${rel.amusement}/100: ${
      rel.amusement <= 25
        ? "they don't particularly entertain you."
        : rel.amusement <= 65
          ? "they can make you smile."
          : "they genuinely crack you up."
    }`,
    `- Annoyance ${rel.annoyance}/100: ${
      rel.annoyance <= 25
        ? "nothing about them grates on you right now."
        : rel.annoyance <= 60
          ? "something about them has been irritating you lately."
          : "they are seriously getting on your nerves."
    }`,
  ];
  return lines.join("\n");
}
