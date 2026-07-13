"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActiveSession, useStopTimer } from "@/lib/queries/sessions";
import { useXpTotals } from "@/lib/queries/xp";
import { STAT_ORDER, type StatKind } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { elapsedSeconds, formatClock } from "@/lib/time";
import {
  generalLevel,
  levelFromXp,
  nextGeneralLevelUp,
  type LevelInfo,
} from "@/lib/xp";

const items = [
  { href: "/projects", label: "Projects", glyph: "◆" },
  { href: "/calendar", label: "Calendar", glyph: "◇" },
  { href: "/stats", label: "Stats", glyph: "▲" },
  { href: "/companions", label: "Companions", glyph: "☽" },
  { href: "/profile", label: "Profile", glyph: "✦" },
];

/** Level + lifetime XP, derived from the same ["xp"] query the profile uses. */
function useLevelSummary() {
  const { data: xp } = useXpTotals();
  if (!xp) return null;
  const statLevels = Object.fromEntries(
    STAT_ORDER.map((s) => [s, levelFromXp(xp[s])])
  ) as Record<StatKind, LevelInfo>;
  return {
    level: generalLevel(statLevels),
    totalXp: STAT_ORDER.reduce((acc, s) => acc + xp[s], 0),
    next: nextGeneralLevelUp(statLevels),
  };
}

/**
 * Running-timer widget for the desktop sidebar — sits between the level card and
 * Sign out. On mobile the floating TimerBar handles this instead (see layout).
 */
function SidebarTimer() {
  const { data: session } = useActiveSession();
  const stopTimer = useStopTimer();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session) return null;

  async function onStop() {
    const outcome = await stopTimer.mutateAsync();
    if (outcome === "discarded") {
      alert("Timer ran past 12 hours — session discarded.");
    }
  }

  return (
    <div className="mx-3 mb-2 rounded-lg border border-accent/40 bg-panel-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
        <Link
          href={
            session.tasks ? `/projects/${session.tasks.project_id}` : "/projects"
          }
          className="min-w-0 flex-1 truncate text-sm text-fg hover:text-accent"
        >
          {session.tasks?.title ?? "Tracking"}
        </Link>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-sm text-accent">
          {formatClock(elapsedSeconds(session.started_at))}
        </span>
        <button
          onClick={onStop}
          disabled={stopTimer.isPending}
          className="shrink-0 rounded border border-danger/60 px-2 py-0.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          ■ Stop
        </button>
      </div>
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const summary = useLevelSummary();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 flex-col border-r border-edge bg-panel md:flex">
        <div className="px-5 py-6">
          <span className="text-sm font-light uppercase tracking-[0.3em] text-accent">
            Astrameath
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-panel-2 text-accent"
                    : "text-muted hover:bg-panel-2 hover:text-fg"
                }`}
              >
                <span aria-hidden>{item.glyph}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {summary && (
          <Link
            href="/profile"
            className="mx-3 mb-2 flex items-center gap-4 rounded-lg border border-edge bg-panel-2 px-4 py-3 transition-colors hover:border-accent/40"
          >
            <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-accent/50">
              <span className="text-[9px] uppercase tracking-widest text-muted">
                Lv
              </span>
              <span className="text-xl leading-none text-accent">
                {summary.level}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base text-fg">
                {summary.totalXp.toLocaleString()} XP
              </span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded bg-panel">
                <span
                  className="block h-full rounded bg-accent transition-[width]"
                  style={{
                    width: `${Math.round(
                      (summary.next.intoLevel / summary.next.toNext) * 100
                    )}%`,
                  }}
                />
              </span>
              <span className="mt-1 block text-xs text-muted">
                {summary.next.remaining} XP to Lv {summary.level + 1}
              </span>
            </span>
          </Link>
        )}
        <SidebarTimer />
        <button
          onClick={signOut}
          className="mx-3 mb-4 rounded px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg"
        >
          Sign out
        </button>
      </aside>

      {/* Mobile bottom nav — the Profile glyph doubles as the level badge */}
      {/* transform-gpu: own compositing layer, so the bar isn't repainted on
          every scroll frame (that repaint is what reads as flicker/lag) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex transform-gpu border-t border-edge bg-panel pb-[env(safe-area-inset-bottom)] will-change-transform md:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const isProfile = item.href === "/profile";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {isProfile && summary ? (
                <span
                  aria-hidden
                  className="flex h-4 min-w-4 items-center justify-center rounded-full border border-current px-0.5 text-[9px] leading-none"
                >
                  {summary.level}
                </span>
              ) : (
                <span aria-hidden className="text-base leading-none">
                  {item.glyph}
                </span>
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
