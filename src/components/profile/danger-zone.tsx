"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Req 16: two separable resets. The schema keeps the app world and the AI
 * world in disjoint tables on purpose, so each reset is a couple of cascade
 * deletes and they never touch each other.
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

async function resetAiData() {
  const supabase = createClient();
  // companions cascade → state, messages, memories
  const del = (
    await supabase.from("companions").delete().not("id", "is", null)
  ).error;
  if (del) throw del;
  const usage = (
    await supabase.from("ai_usage").delete().not("id", "is", null)
  ).error;
  if (usage) throw usage;
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
            className="rounded border border-danger/60 px-3 py-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            {mutation.isPending ? "Wiping…" : confirmLabel}
          </button>
          <button
            onClick={() => setArmed(false)}
            className="text-muted hover:text-fg"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setArmed(true)}
          className="rounded border border-edge px-3 py-1.5 text-sm text-muted transition-colors hover:border-danger/50 hover:text-danger"
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
          title="Reset AI data"
          blurb="Deletes every companion with their chats, relationships, memories and the cost ledger. App data is untouched."
          confirmLabel="Wipe AI data"
          action={resetAiData}
        />
      </div>
    </div>
  );
}
