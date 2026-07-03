"use client";

import type { Relationship } from "@/lib/ai/state";

/** Wire shape of the /api/ai/chat "done" SSE event. */
export type ChatDone = {
  text: string;
  state: {
    relationship: Relationship;
    mood: string | null;
    mood_reason: string | null;
  };
  costUsd: number;
  usage: { input: number; output: number; cacheRead: number };
  messageCount: number;
};

const MEMORIZE_THRESHOLD = 80; // matches KEEP_RECENT + MIN_BATCH server-side

/**
 * POST to /api/ai/chat and consume the SSE stream. Resolves with the done
 * event after the full turn (reply + state persisted server-side).
 */
export async function streamChat({
  companionId,
  message,
  onDelta,
  signal,
}: {
  companionId: string;
  message: string;
  onDelta: (fullText: string) => void;
  signal?: AbortSignal;
}): Promise<ChatDone> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companionId,
      message,
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res
      .json()
      .then((j) => j.error)
      .catch(() => "");
    throw new Error(detail || `Chat request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let done: ChatDone | null = null;

  try {
    while (true) {
      const { value, done: eof } = await reader.read();
      if (eof) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = raw
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        let event: { type: string } & Record<string, unknown>;
        try {
          event = JSON.parse(dataLine.slice(6));
        } catch {
          continue;
        }
        if (event.type === "delta") {
          text += event.text as string;
          onDelta(text);
        } else if (event.type === "done") {
          done = event as unknown as ChatDone;
        } else if (event.type === "error") {
          throw new Error((event.message as string) || "Inference failed");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!done) throw new Error("Stream ended without a result");

  // fire-and-forget history compression once the chat outgrows the window
  if (done.messageCount > MEMORIZE_THRESHOLD) {
    fetch("/api/ai/memorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionId }),
    }).catch(() => {});
  }

  return done;
}
