"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fillTemplate, parsePersona } from "@/lib/ai/persona";
import { createClient } from "@/lib/supabase/client";

/**
 * Req 16: two separable resets. The schema keeps the app world and the AI
 * world in disjoint tables on purpose, so the resets never touch each other.
 */
async function resetAppData() {
  const supabase = createClient();
  // projects cascade → goals, milestones, tasks, completions, time sessions
  const del = (await supabase.from("projects").delete().not("id", "is", null))
    .error;
  if (del) throw del;
  // wipe the XP ledger (cascade-revoke triggers leave nothing meaningful behind)
  const xp = (await supabase.from("xp_events").delete().not("id", "is", null))
    .error;
  if (xp) throw xp;
}

/**
 * Companions themselves survive (persona, avatar, model); only their lived
 * history resets — chats, relationship state, memories. Each ends up exactly
 * as freshly created: bare state row + greeting as the first message. The
 * ai_usage ledger stays: it records real money spent, not character state.
 */
async function resetAiData() {
  const supabase = createClient();
  const [companionsRes, profileRes] = await Promise.all([
    supabase.from("companions").select("id, name, persona"),
    supabase.from("profiles").select("display_name").single(),
  ]);
  if (companionsRes.error) throw companionsRes.error;

  for (const table of [
    "companion_messages",
    "companion_memories",
    "companion_state",
  ] as const) {
    const { error } = await supabase
      .from(table)
      .delete()
      .not("companion_id", "is", null);
    if (error) throw error;
  }

  const userName = profileRes.data?.display_name ?? "";
  for (const c of companionsRes.data ?? []) {
    const { error: stateError } = await supabase
      .from("companion_state")
      .insert({ companion_id: c.id });
    if (stateError) throw stateError;
    const greeting = parsePersona(c.persona).greeting.trim();
    if (greeting) {
      const { error: msgError } = await supabase
        .from("companion_messages")
        .insert({
          companion_id: c.id,
          role: "assistant",
          content: fillTemplate(greeting, c.name, userName),
        });
      if (msgError) throw msgError;
    }
  }
}

function ResetRow({
  title,
  blurb,
  confirmLabel,
  action,
}: {
  title: string;
  blurb: string;
  confirmLabel: string;
  action: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => {
      setArmed(false);
      queryClient.invalidateQueries();
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-panel p-4">
      <div className="min-w-0">
        <p className="text-sm">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted">{blurb}</p>
        {mutation.isError && (
          <p className="mt-1 text-[11px] text-danger">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Reset failed"}
          </p>
        )}
      </div>
      {armed ? (
        <span className="flex items-center gap-2 text-sm">
          <span className="text-danger">This cannot be undone.</span>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex min-h-11 items-center rounded border border-danger/60 px-3 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 sm:min-h-0 sm:py-1.5"
          >
            {mutation.isPending ? "Wiping…" : confirmLabel}
          </button>
          <button
            onClick={() => setArmed(false)}
            className="inline-flex min-h-11 items-center px-1 text-muted hover:text-fg sm:min-h-0"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setArmed(true)}
          className="inline-flex min-h-11 items-center rounded border border-edge px-3 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger sm:min-h-0 sm:py-1.5"
        >
          Reset…
        </button>
      )}
    </div>
  );
}

export default function DangerZone() {
  return (
    <div className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-danger/80">
        Danger zone
      </h2>
      <div className="mt-2 space-y-2">
        <ResetRow
          title="Reset app data"
          blurb="Deletes every project, goal, task, tracked session and all XP. Companions are untouched."
          confirmLabel="Wipe app data"
          action={resetAppData}
        />
        <ResetRow
          title="Reset companions"
          blurb="Every companion starts over: chats, relationship stats, moods and memories are wiped. The characters themselves, their avatars and the cost ledger stay."
          confirmLabel="Reset all bonds"
          action={resetAiData}
        />
      </div>
    </div>
  );
}
