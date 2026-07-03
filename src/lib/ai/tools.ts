import type Anthropic from "@anthropic-ai/sdk";

/**
 * The update_state tool, called once per turn after the in-character reply.
 * V1 lesson: tool_choice must stay "auto" — forcing {type:"tool"} makes the
 * API skip the text response entirely. The system prompt instructs the model
 * to always call it, which works reliably.
 */
export function updateStateTool(charName: string): Anthropic.Tool {
  return {
    name: "update_state",
    description: `Record the relationship deltas, mood change, and any memory-worthy moment from the exchange you just had with the user. You MUST call this tool exactly once on every turn, after responding in character as ${charName}. Do not skip it. Do not call it twice.`,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "affection_delta",
        "trust_delta",
        "respect_delta",
        "amusement_delta",
        "annoyance_delta",
        "new_mood",
        "mood_reason",
        "memory_worthy",
        "memory_text",
        "reasoning",
      ],
      properties: {
        affection_delta: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "How affection toward the user shifted this turn. Most turns -2 to +2; reserve larger swings for genuine emotional moments.",
        },
        trust_delta: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "How trust shifted. Slow to build; drops on dishonesty or broken promises.",
        },
        respect_delta: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "How respect shifted. Rises with discipline, consistency, courage, skill. Drops with laziness or excuses.",
        },
        amusement_delta: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "How amused the character is by the user. Rises with wit, playfulness, shared jokes. Falls when things get dull or heavy.",
        },
        annoyance_delta: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "How annoyed the character is. Rises from rudeness, whining, being ignored. Falls when the user makes up for it.",
        },
        new_mood: {
          type: "string",
          description:
            "The character's mood after this exchange, one or two lowercase words (e.g. 'content', 'quietly amused', 'irritated').",
        },
        mood_reason: {
          type: "string",
          description:
            "One short clause in the character's voice explaining why this mood.",
        },
        memory_worthy: {
          type: "boolean",
          description:
            "True only if this exchange would still matter 20 conversations from now. Personal revelations and emotional moments matter more than productivity stats.",
        },
        memory_text: {
          type: "string",
          description:
            "A short third-person sentence describing what happened, if memory_worthy. Empty string otherwise.",
        },
        reasoning: {
          type: "string",
          description:
            "One sentence summarizing what just happened this turn, for the character's short-term recollection.",
        },
      },
    },
  };
}

export type StateUpdate = {
  affection_delta: number;
  trust_delta: number;
  respect_delta: number;
  amusement_delta: number;
  annoyance_delta: number;
  new_mood: string;
  mood_reason: string;
  memory_worthy: boolean;
  memory_text: string;
  reasoning: string;
};

/** Defensive parse of the tool input — a roleplay model can get creative. */
export function parseStateUpdate(input: unknown): StateUpdate | null {
  if (!input || typeof input !== "object") return null;
  const v = input as Record<string, unknown>;
  const delta = (x: unknown, cap: number) =>
    typeof x === "number" && Number.isFinite(x)
      ? Math.max(-cap, Math.min(cap, Math.round(x)))
      : 0;
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  return {
    affection_delta: delta(v.affection_delta, 10),
    trust_delta: delta(v.trust_delta, 10),
    respect_delta: delta(v.respect_delta, 10),
    amusement_delta: delta(v.amusement_delta, 10),
    annoyance_delta: delta(v.annoyance_delta, 10),
    new_mood: str(v.new_mood) || "neutral",
    mood_reason: str(v.mood_reason),
    memory_worthy: v.memory_worthy === true,
    memory_text: str(v.memory_text),
    reasoning: str(v.reasoning),
  };
}
