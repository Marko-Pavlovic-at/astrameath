import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { parsePersona } from "@/lib/ai/persona";
import { computeCostUsd, totalInputTokens } from "@/lib/ai/pricing";
import {
  buildMessages,
  buildSystemBlocks,
  buildTemporalBlock,
  type HistoryRow,
} from "@/lib/ai/prompt";
import {
  applyAbsenceDecay,
  applyDeltas,
  parseRelationship,
} from "@/lib/ai/state";
import { parseStateUpdate, updateStateTool } from "@/lib/ai/tools";
import { buildAppSnapshot } from "@/lib/ai/snapshot";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const maxDuration = 60;

const HISTORY_LIMIT = 30;
const RECENT_EVENTS_CAP = 8;
const MAX_MESSAGE_CHARS = 4000;

/**
 * One streamed inference per turn (V1 architecture): the model writes the
 * in-character reply as text, then calls update_state in the same response.
 * The route owns all persistence — messages, state, memories, ai_usage — so
 * the client only renders. SSE out: {type:"delta"|"done"|"error", ...}.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const companionId: unknown = body?.companionId;
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  const tzOffsetMinutes =
    typeof body?.tzOffsetMinutes === "number" ? body.tzOffsetMinutes : 0;
  if (typeof companionId !== "string" || !message) {
    return NextResponse.json(
      { error: "companionId and message are required" },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  // ── Load everything the prompt needs (RLS scopes it all to this user) ──────
  const now = new Date();
  const [companionRes, stateRes, memoriesRes, historyRes, profileRes] =
    await Promise.all([
      supabase.from("companions").select("*").eq("id", companionId).single(),
      supabase
        .from("companion_state")
        .select("*")
        .eq("companion_id", companionId)
        .maybeSingle(),
      supabase
        .from("companion_memories")
        .select("content, importance")
        .eq("companion_id", companionId)
        .order("importance", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("companion_messages")
        .select("role, content, created_at")
        .eq("companion_id", companionId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase.from("profiles").select("display_name").single(),
    ]);

  if (companionRes.error || !companionRes.data) {
    return NextResponse.json({ error: "Companion not found" }, { status: 404 });
  }
  const companion = companionRes.data;
  const model = companion.model?.startsWith("claude-")
    ? companion.model
    : "claude-haiku-4-5";
  const persona = parsePersona(companion.persona);
  const userName = profileRes.data?.display_name ?? "";

  const stateRow = stateRes.data;
  const { rel: relationship } = applyAbsenceDecay(
    parseRelationship(stateRow?.relationship),
    stateRow?.last_seen_at ?? null,
    now
  );
  const recentEvents = Array.isArray(stateRow?.recent_events)
    ? (stateRow.recent_events as unknown[]).filter(
        (e): e is string => typeof e === "string"
      )
    : [];

  const history: HistoryRow[] = (historyRes.data ?? [])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
  const lastUserMessageAt =
    historyRes.data?.find((m) => m.role === "user")?.created_at ?? null;

  const snapshot = await buildAppSnapshot(supabase, userName, now, tzOffsetMinutes);

  const system = buildSystemBlocks({
    charName: companion.name,
    persona,
    userName,
    relationship,
    mood: stateRow?.mood ?? null,
    moodReason: stateRow?.mood_reason ?? null,
    recentEvents,
    memories: (memoriesRes.data ?? []).map((m) => m.content),
    snapshot,
    temporal: buildTemporalBlock({
      now,
      tzOffsetMinutes,
      lastUserMessageAt,
      userName,
    }),
  });

  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 800,
    temperature: 0.9,
    system,
    messages: buildMessages(history, message),
    tools: [{ ...updateStateTool(companion.name), cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "auto" },
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        stream.on("text", (delta) => send({ type: "delta", text: delta }));
        const final = await stream.finalMessage();

        const text = final.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        const toolUse = final.content.find(
          (b) => b.type === "tool_use" && b.name === "update_state"
        );
        const update =
          toolUse && toolUse.type === "tool_use"
            ? parseStateUpdate(toolUse.input)
            : null;

        // ── Persist the turn ────────────────────────────────────────────────
        const newRel = update ? applyDeltas(relationship, update) : relationship;
        const newEvents = update?.reasoning
          ? [...recentEvents, update.reasoning].slice(-RECENT_EVENTS_CAP)
          : recentEvents;

        const writes: PromiseLike<unknown>[] = [
          supabase
            .from("companion_messages")
            .insert([
              {
                companion_id: companion.id,
                role: "user" as const,
                content: message,
                created_at: now.toISOString(),
              },
              {
                companion_id: companion.id,
                role: "assistant" as const,
                content: text || "…",
                created_at: new Date(now.getTime() + 1000).toISOString(),
              },
            ]),
          supabase
            .from("companion_state")
            .upsert({
              companion_id: companion.id,
              relationship: newRel as unknown as Json,
              mood: update?.new_mood ?? stateRow?.mood ?? null,
              mood_reason: update?.mood_reason ?? stateRow?.mood_reason ?? null,
              recent_events: newEvents as unknown as Json,
              last_seen_at: now.toISOString(),
              updated_at: new Date().toISOString(),
            }),
          supabase
            .from("ai_usage")
            .insert({
              companion_id: companion.id,
              input_tokens: totalInputTokens(final.usage),
              output_tokens: final.usage.output_tokens ?? 0,
              cost_usd: computeCostUsd(model, final.usage),
            }),
        ];
        if (update?.memory_worthy && update.memory_text) {
          writes.push(
            supabase
              .from("companion_memories")
              .insert({
                companion_id: companion.id,
                content: update.memory_text,
                importance: 3,
              })
          );
        }
        const results = await Promise.all(writes);
        for (const r of results) {
          const err = (r as { error?: { message: string } | null })?.error;
          if (err) console.error("[ai/chat] persist error:", err.message);
        }

        send({
          type: "done",
          text,
          state: {
            relationship: newRel,
            mood: update?.new_mood ?? stateRow?.mood ?? null,
            mood_reason: update?.mood_reason ?? stateRow?.mood_reason ?? null,
          },
          costUsd: computeCostUsd(model, final.usage),
          usage: {
            input: totalInputTokens(final.usage),
            output: final.usage.output_tokens ?? 0,
            cacheRead: final.usage.cache_read_input_tokens ?? 0,
          },
          messageCount: history.length + 2,
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Inference failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
