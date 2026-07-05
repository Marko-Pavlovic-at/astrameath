"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamChat } from "@/lib/ai/client";
import {
  AXES,
  deriveArchetype,
  parseRelationship,
  type Relationship,
} from "@/lib/ai/state";
import {
  useAiSpend,
  useCompanion,
  useCompanionMessages,
} from "@/lib/queries/companions";
import { Avatar } from "./companions-view";

/** Roleplay text: *actions* italic + muted, speech plain. */
function RoleplayText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <em key={i} className="text-muted">
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function AxisBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="flex justify-between text-[11px]">
        <span className="capitalize text-muted">{label}</span>
        <span>{value}</span>
      </p>
      <div className="mt-0.5 h-1 overflow-hidden rounded bg-panel-2">
        <div
          className="h-full rounded bg-accent transition-[width]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

type LocalMessage = { role: "user" | "assistant"; content: string };

/** `compact` renders the same chat as a fill-parent column (companion sidebar):
 * no back link, name links to the full-page chat. */
export default function ChatView({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: companion } = useCompanion(id);
  const { data: messages } = useCompanionMessages(id);
  const { data: spend } = useAiSpend();

  // in-flight turn (optimistic user msg + streaming reply), cleared on settle
  const [pending, setPending] = useState<LocalMessage[]>([]);
  const [liveState, setLiveState] = useState<{
    relationship: Relationship;
    mood: string | null;
    mood_reason: string | null;
  } | null>(null);
  const [sessionUsd, setSessionUsd] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showState, setShowState] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLen = useRef(0);
  const streamedLen = (pending[1]?.content.length ?? 0) + (messages?.length ?? 0);
  useEffect(() => {
    if (streamedLen !== lastLen.current) {
      lastLen.current = streamedLen;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  });

  if (!companion) return <p className="text-sm text-muted">Loading…</p>;

  const state = companion.companion_state;
  const relationship =
    liveState?.relationship ?? parseRelationship(state?.relationship);
  const mood = liveState?.mood ?? state?.mood;
  const moodReason = liveState?.mood_reason ?? state?.mood_reason;
  const companionSpend = spend?.byCompanion[id] ?? 0;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setBusy(true);
    setPending([
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    try {
      const done = await streamChat({
        companionId: id,
        message: text,
        onDelta: (full) =>
          setPending([
            { role: "user", content: text },
            { role: "assistant", content: full },
          ]),
      });
      setLiveState(done.state);
      setSessionUsd((usd) => usd + done.costUsd);
      await queryClient.invalidateQueries({
        queryKey: ["companion-messages", id],
      });
      queryClient.invalidateQueries({ queryKey: ["ai-spend"] });
      queryClient.invalidateQueries({ queryKey: ["companions"] });
      setPending([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending([]);
      setInput(text); // give the message back
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const allMessages: LocalMessage[] = [
    ...(messages ?? []).map((m) => ({ role: m.role, content: m.content })),
    ...pending,
  ];

  return (
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-col"
          : "mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col md:h-[calc(100dvh-4rem)]"
      }
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-edge pb-3">
        {!compact && (
          <Link
            href="/companions"
            aria-label="Back to companions"
            className="text-muted hover:text-fg"
          >
            ←
          </Link>
        )}
        <Avatar url={companion.avatar_url} name={companion.name} size="size-10" />
        <div className="min-w-0 flex-1">
          {compact ? (
            <Link
              href={`/companions/${id}`}
              className="block truncate text-base leading-tight hover:text-accent"
            >
              {companion.name}
            </Link>
          ) : (
            <p className="truncate text-base leading-tight">{companion.name}</p>
          )}
          <p className="truncate text-[11px] text-muted">
            {deriveArchetype(relationship)}
            {mood ? ` · ${mood}` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowState((s) => !s)}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            showState
              ? "border-accent/60 text-accent"
              : "border-edge text-muted hover:text-fg"
          }`}
        >
          Bond
        </button>
        <Link
          href={`/companions/${id}/edit`}
          className="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-fg"
        >
          Edit
        </Link>
      </div>

      {/* relationship panel */}
      {showState && (
        <div className="border-b border-edge bg-panel px-4 py-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {AXES.map((axis) => (
              <AxisBar key={axis} label={axis} value={relationship[axis]} />
            ))}
          </div>
          {moodReason && (
            <p className="mt-2 text-[11px] italic text-muted">“{moodReason}”</p>
          )}
          <p className="mt-2 text-[11px] text-muted">
            Session ${sessionUsd.toFixed(4)} · this companion $
            {companionSpend.toFixed(4)} · all-time $
            {(spend?.lifetime ?? 0).toFixed(4)}
          </p>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
        {allMessages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2">
              <Avatar
                url={companion.avatar_url}
                name={companion.name}
                size="size-7 text-xs"
              />
              <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-edge bg-panel px-3 py-2 text-sm">
                {m.content ? (
                  <RoleplayText text={m.content} />
                ) : (
                  <span className="text-muted">…</span>
                )}
              </div>
            </div>
          )
        )}
        {error && <p className="px-1 text-xs text-danger">{error}</p>}
      </div>

      {/* input */}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-edge pt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={input.includes("\n") ? 3 : 1}
          placeholder={`Say something to ${companion.name}…`}
          aria-label="Message"
          className="max-h-32 flex-1 resize-none rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded border border-accent/40 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
