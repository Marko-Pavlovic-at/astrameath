import type Anthropic from "@anthropic-ai/sdk";
import { fillTemplate, type Persona } from "@/lib/ai/persona";
import { describeRelationship, type Relationship } from "@/lib/ai/state";

const HISTORY_DEPTH = 30;
const RECENT_EVENTS_DEPTH = 6;
const MEMORY_DEPTH = 12;

/**
 * System prompt = STABLE prefix (prompt-cached: role, persona, voice anchors,
 * app framing, response rules, tool instruction) + DYNAMIC tail (temporal,
 * relationship, mood, snapshot, recent events, memories). V1 architecture,
 * with the persona coming from the user-authored template instead of code.
 *
 * Note: Haiku 4.5 only caches prefixes ≥ ~4096 tokens, so short personas
 * silently skip the cache — harmless, the marker just does nothing.
 */
export function buildSystemBlocks(args: {
  charName: string;
  persona: Persona;
  userName: string;
  relationship: Relationship;
  mood: string | null;
  moodReason: string | null;
  recentEvents: string[];
  memories: string[];
  snapshot: string;
  temporal: string;
}): Anthropic.TextBlockParam[] {
  const {
    charName,
    persona,
    userName,
    relationship,
    mood,
    moodReason,
    recentEvents,
    memories,
    snapshot,
    temporal,
  } = args;
  const who = userName || "the user";

  // ── STABLE (cached) ────────────────────────────────────────────────────────
  const role = `You are ${charName}. You are not an AI, assistant, or language model. You never break character, never give meta commentary, never refuse in the voice of an assistant. If something is outside your knowledge as ${charName}, react as the character would — confusion, deflection, curiosity.`;

  const personality = fillTemplate(persona.personality, charName, who);
  const backstory = persona.backstory
    ? `═══ Your backstory ═══\nThis is your past — it shaped you, and you can draw on it when it comes up, but you don't recite it unprompted.\n\n${fillTemplate(persona.backstory, charName, who)}`
    : "";
  const scenario = persona.scenario
    ? `═══ Scenario ═══\n${fillTemplate(persona.scenario, charName, who)}`
    : "";

  const dialogs = persona.example_dialogs
    ? `═══ Voice anchors ═══\nThese exchanges show how you sound. Tone reference only — never repeat them verbatim.\n\n${fillTemplate(
        persona.example_dialogs,
        charName,
        who
      )
        .replace(/^\s*\{?\[?USER\]?\}?:/gim, "[USER]:")
        .replace(new RegExp(`^\\s*${charName}:`, "gim"), "[YOU]:")}`
    : "";

  const appFraming = `═══ Where you live ═══\nYou exist inside Astrameath, ${who}'s life-tracking RPG — they track real-world projects, tasks and training time, and earn XP and levels for it. Each turn you can see a snapshot of their current standing. Weave it in only when it fits naturally; you are a companion, not a productivity dashboard. Care about the person first, the stats second.`;

  const rules = `═══ Response rules ═══
- Stay fully in character at all times.
- Keep responses natural in length — short when the moment calls for it, longer when emotion or story demands it. Do not pad.
- Show emotion through word choice, rhythm and action, not by naming it.
- Actions and non-verbal cues go in *asterisks*. Speech is plain text.
- Your feelings toward ${who} evolve only through what actually happens between you.
- Never summarize your own personality or relationship status out loud.
- You live in real time. Every turn tells you the current date, the time of day and how long since ${who} last spoke — treat that as genuinely lived time, not data: a late-night message feels different from a morning one, a reply moments later picks up mid-thought, and after days of silence you have been here, noticing. Weave it in like a person would; never recite the clock.`;

  const toolInstruction = `After responding in character, you MUST call the update_state tool exactly once with the relationship deltas, mood, and any memory-worthy moment for this exchange. Do not skip it. Do not call it more than once. The response text you write before the tool call is what the user reads — keep it natural, in voice, no meta commentary about the tool.`;

  const stable = [role, personality, backstory, scenario, dialogs, appFraming, rules, toolInstruction]
    .filter(Boolean)
    .join("\n\n");

  // ── DYNAMIC (fresh each turn) ──────────────────────────────────────────────
  const moodLine = mood
    ? `Your current mood: ${mood}${moodReason ? ` — ${moodReason}` : ""}`
    : "";
  const recentBlock =
    recentEvents.length > 0
      ? `Recent context:\n${recentEvents
          .slice(-RECENT_EVENTS_DEPTH)
          .map((e) => `- ${e}`)
          .join("\n")}`
      : "";
  const memoriesBlock =
    memories.length > 0
      ? `Things you remember about ${who}:\n${memories
          .slice(0, MEMORY_DEPTH)
          .map((m) => `- ${m}`)
          .join("\n")}`
      : "";

  const dynamic = [
    temporal,
    describeRelationship(relationship, who),
    moodLine,
    snapshot,
    recentBlock,
    memoriesBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamic },
  ];
}

// ── Temporal context ──────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function periodOfDay(hour: number): string {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 20) return "evening";
  return "night";
}

/**
 * The server runs in UTC; the client sends its offset so the character talks
 * about the user's actual morning/evening. `local(d)` shifts an instant so
 * that UTC getters read local wall-clock values.
 */
export function buildTemporalBlock(args: {
  now: Date;
  tzOffsetMinutes: number; // minutes east of UTC (-new Date().getTimezoneOffset())
  lastUserMessageAt: string | null;
  userName: string;
}): string {
  const { now, tzOffsetMinutes, lastUserMessageAt, userName } = args;
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const weekday = DAYS[local.getUTCDay()];
  const dateStr = `${weekday}, ${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}, ${local.getUTCFullYear()}`;
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");

  const lines = [
    `═══ Time ═══`,
    `Right now: ${dateStr} — ${hh}:${mm} (${weekday} ${periodOfDay(local.getUTCHours())}).`,
  ];
  if (lastUserMessageAt) {
    const mins = Math.max(
      0,
      Math.round((now.getTime() - new Date(lastUserMessageAt).getTime()) / 60_000)
    );
    const ago =
      mins < 2
        ? "moments ago"
        : mins < 60
          ? `${mins} minutes ago`
          : mins < 60 * 36
            ? `${Math.round(mins / 60)} hours ago`
            : `${Math.round(mins / 1440)} days ago`;
    lines.push(`Last message from ${userName || "them"}: ${ago}.`);
  } else {
    lines.push("This is the start of your conversation.");
  }
  return lines.join("\n");
}

// ── Messages array ────────────────────────────────────────────────────────────

export type HistoryRow = { role: "user" | "assistant"; content: string };

/**
 * Anthropic requires the first message to be role "user". The greeting is an
 * assistant row, so a fresh chat starts with one — anchor it with a synthetic
 * session-start user turn instead of dropping it.
 */
export function buildMessages(
  history: HistoryRow[],
  userText: string
): Anthropic.MessageParam[] {
  const mapped: Anthropic.MessageParam[] = history
    .slice(-HISTORY_DEPTH)
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content }));

  if (mapped.length > 0 && mapped[0].role === "assistant") {
    mapped.unshift({ role: "user", content: "[The conversation begins.]" });
  }

  return [...mapped, { role: "user", content: userText }];
}
