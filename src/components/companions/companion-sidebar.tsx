"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import ChatView from "@/components/companions/chat-view";
import { useCompanions } from "@/lib/queries/companions";

/**
 * The companion is reachable from every view (testing feedback 2026-07-05):
 * a desktop-only (≥1200px, V1's breakpoint) right rail with the compact chat.
 * Hidden on the /companions routes — those are the full experience.
 * Defaults to the most recently talked-to companion.
 */
export default function CompanionSidebar() {
  const pathname = usePathname();
  const { data: companions } = useCompanions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (pathname.startsWith("/companions")) return null;
  if (!companions || companions.length === 0) return null;

  const byRecency = [...companions].sort((a, b) =>
    (b.companion_state?.last_seen_at ?? b.created_at).localeCompare(
      a.companion_state?.last_seen_at ?? a.created_at
    )
  );
  const active =
    companions.find((c) => c.id === selectedId) ?? byRecency[0];

  return (
    <aside className="sticky top-0 hidden h-dvh w-[340px] shrink-0 flex-col border-l border-edge bg-panel p-3 min-[1200px]:flex">
      {companions.length > 1 && (
        <select
          value={active.id}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="Companion"
          className="mb-3 rounded border border-edge bg-panel-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent"
        >
          {companions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <div className="min-h-0 flex-1">
        <ChatView id={active.id} compact />
      </div>
    </aside>
  );
}
