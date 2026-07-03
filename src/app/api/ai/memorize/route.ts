import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { parsePersona } from "@/lib/ai/persona";
import { computeCostUsd, totalInputTokens } from "@/lib/ai/pricing";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Chat-memory compression: when a conversation outgrows the window the chat
 * route actually sends (last 30), the oldest messages are distilled into
 * permanent companion_memories rows and then deleted. Triggered by the client
 * after a turn once the history passes the threshold; cheap no-op otherwise.
 */
const KEEP_RECENT = 60; // never touch the newest N messages
const MIN_BATCH = 20; // only run once there's a meaningful chunk to compress
const MAX_BATCH = 80;

const FACTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["content", "importance"],
        properties: {
          content: {
            type: "string",
            description:
              "One permanent memory, a single third-person sentence.",
          },
          importance: {
            type: "integer",
            enum: [1, 2, 3, 4, 5],
            description: "5 = defining moment, 1 = minor but worth keeping.",
          },
        },
      },
    },
  },
} as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companionId: unknown = body?.companionId;
  if (typeof companionId !== "string") {
    return NextResponse.json({ error: "companionId required" }, { status: 400 });
  }

  const { data: companion } = await supabase
    .from("companions")
    .select("*")
    .eq("id", companionId)
    .single();
  if (!companion) {
    return NextResponse.json({ error: "Companion not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("companion_messages")
    .select("id", { count: "exact", head: true })
    .eq("companion_id", companionId);
  const total = count ?? 0;
  if (total < KEEP_RECENT + MIN_BATCH) {
    return NextResponse.json({ compressed: 0, added: 0 });
  }

  const batchSize = Math.min(total - KEEP_RECENT, MAX_BATCH);
  const [{ data: oldest }, { data: existingMemories }, { data: profile }] =
    await Promise.all([
      supabase
        .from("companion_messages")
        .select("id, role, content")
        .eq("companion_id", companionId)
        .order("created_at", { ascending: true })
        .limit(batchSize),
      supabase
        .from("companion_memories")
        .select("content")
        .eq("companion_id", companionId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("profiles").select("display_name").single(),
    ]);
  if (!oldest || oldest.length < MIN_BATCH) {
    return NextResponse.json({ compressed: 0, added: 0 });
  }

  const userName = profile?.display_name || "the user";
  const charName = companion.name;
  const persona = parsePersona(companion.persona);
  const model = companion.model?.startsWith("claude-")
    ? companion.model
    : "claude-haiku-4-5";

  const transcript = oldest
    .map((m) => `${m.role === "user" ? userName : charName}: ${m.content}`)
    .join("\n");
  const known =
    existingMemories && existingMemories.length > 0
      ? `\n\nAlready remembered (do NOT repeat these):\n${existingMemories
          .map((m) => `- ${m.content}`)
          .join("\n")}`
      : "";

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    system: `You compress roleplay chat history into permanent memories. The character is ${charName} (${persona.tagline || "a companion"}); the person they talk to is ${userName}. Extract up to 5 facts from the transcript that ${charName} should remember forever: personal revelations, emotional moments, promises, running jokes, preferences, milestones in the relationship. Skip day-to-day productivity chatter unless it marked a real turning point. Write each as one third-person sentence. Return an empty list if nothing qualifies.`,
    messages: [
      {
        role: "user",
        content: `Transcript (oldest part of the conversation, about to be forgotten):\n\n${transcript}${known}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: FACTS_SCHEMA },
    },
  });

  let facts: Array<{ content: string; importance: number }> = [];
  const textBlock = response.content.find((b) => b.type === "text");
  if (textBlock && textBlock.type === "text") {
    try {
      const parsed = JSON.parse(textBlock.text) as {
        facts?: Array<{ content?: unknown; importance?: unknown }>;
      };
      facts = (parsed.facts ?? [])
        .filter((f) => typeof f.content === "string" && f.content)
        .slice(0, 5)
        .map((f) => ({
          content: f.content as string,
          importance:
            typeof f.importance === "number"
              ? Math.max(1, Math.min(5, Math.round(f.importance)))
              : 3,
        }));
    } catch {
      // schema-constrained output should always parse; bail without deleting
      return NextResponse.json(
        { error: "Memory extraction returned invalid JSON" },
        { status: 502 }
      );
    }
  }

  if (facts.length > 0) {
    const { error } = await supabase.from("companion_memories").insert(
      facts.map((f) => ({
        companion_id: companion.id,
        content: f.content,
        importance: f.importance,
      }))
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Only delete once the facts are safely stored.
  const { error: delError } = await supabase
    .from("companion_messages")
    .delete()
    .in(
      "id",
      oldest.map((m) => m.id)
    );
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  await supabase.from("ai_usage").insert({
    companion_id: companion.id,
    input_tokens: totalInputTokens(response.usage),
    output_tokens: response.usage.output_tokens ?? 0,
    cost_usd: computeCostUsd(model, response.usage),
  });

  return NextResponse.json({ compressed: oldest.length, added: facts.length });
}
