"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import ChatView from "@/components/companions/chat-view";
import { Avatar } from "@/components/companions/companions-view";
import { useCompanions } from "@/lib/queries/companions";

const COLLAPSED_KEY = "companion-sidebar-collapsed";
const COLLAPSED_EVENT = "companion-sidebar-toggle";

function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSED_EVENT, cb);
  return () => window.removeEventListener(COLLAPSED_EVENT, cb);
}

/**
 * The companion is reachable from every view (testing feedback 2026-07-05):
 * a desktop-only (≥1200px, V1's breakpoint) right rail with the compact chat.
 * Hidden on the /companions routes — those are the full experience.
 * Defaults to the most recently talked-to companion. Minimizable to a floating
 * avatar bubble; the choice persists in localStorage (useSyncExternalStore so
 * the SSR pass renders open and the client corrects itself without a
 * hydration mismatch).
 */
export default function CompanionSidebar() {
  const pathname = usePathname();
  const { data: companions } = useCompanions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
    () => false
  );

  function toggle(next: boolean) {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  }

  if (pathname.startsWith("/companions")) return null;
  if (!companions || companions.length === 0) return null;

  const byRecency = [...companions].sort((a, b) =>
    (b.companion_state?.last_seen_at ?? b.created_at).localeCompare(
      a.companion_state?.last_seen_at ?? a.created_at
    )
  );
  const active =
    companions.find((c) => c.id === selectedId) ?? byRecency[0];

  if (collapsed) {
    return (
      <button
        onClick={() => toggle(false)}
        aria-label={`Show ${active.name}`}
        title={active.name}
        className="fixed bottom-4 right-4 z-10 hidden size-12 items-center justify-center rounded-full border border-edge bg-panel shadow-lg transition-colors hover:border-accent/50 min-[1200px]:flex"
      >
        <Avatar url={active.avatar_url} name={active.name} size="size-10" />
      </button>
    );
  }

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
        <ChatView id={active.id} compact onCollapse={() => toggle(true)} />
      </div>
    </aside>
  );
}
