"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QuickAddTask from "@/components/quick-add-task";
import {
  useActiveSession,
  useStopTimer,
  type ActiveSession,
} from "@/lib/queries/sessions";
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

/** The running session, re-rendered once a second so the clock ticks. */
function useRunningSession() {
  const { data: session } = useActiveSession();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  return session ?? null;
}

/** Shared stop handler — the 12h discard is enforced server-side on stop. */
function useStop() {
  const stopTimer = useStopTimer();

  async function stop() {
    const outcome = await stopTimer.mutateAsync();
    if (outcome === "discarded") {
      alert("Timer ran past 12 hours — session discarded.");
    }
  }

  return { stop, isPending: stopTimer.isPending };
}

function sessionHref(session: ActiveSession) {
  return session.tasks ? `/projects/${session.tasks.project_id}` : "/projects";
}

/** Running-timer card for the desktop sidebar — between the level card and Sign out. */
function SidebarTimer() {
  const session = useRunningSession();
  const { stop, isPending } = useStop();

  if (!session) return null;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-accent/40 bg-panel-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
        <Link
          href={sessionHref(session)}
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
          onClick={stop}
          disabled={isPending}
          className="shrink-0 rounded border border-danger/60 px-2 py-0.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          ■ Stop
        </button>
      </div>
    </div>
  );
}

/**
 * Compact running timer for the mobile top bar. This replaces the old floating
 * TimerBar: nothing on mobile is anchored to the bottom of the viewport any more,
 * which is what used to flicker as the browser's URL bar slid in and out.
 * The clock links to the project — the task title doesn't fit at 375px.
 */
function TopBarTimer({ session }: { session: ActiveSession }) {
  const { stop, isPending } = useStop();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-accent/40 bg-panel-2 pl-2">
      <Link
        href={sessionHref(session)}
        aria-label={`Tracking ${session.tasks?.title ?? "time"} — open project`}
        className="flex min-h-11 items-center gap-1.5 pr-1"
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
        <span className="font-mono text-sm text-accent">
          {formatClock(elapsedSeconds(session.started_at))}
        </span>
      </Link>
      <button
        onClick={stop}
        disabled={isPending}
        aria-label="Stop timer"
        className="inline-flex min-h-11 items-center rounded-r-lg border-l border-accent/40 px-3 text-sm text-danger transition-colors active:bg-danger/10 disabled:opacity-50"
      >
        ■
      </button>
    </div>
  );
}

/** The level badge that both the top bar and the drawer link to /profile with. */
function LevelBadge({ level }: { level: number }) {
  return (
    <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-full border-2 border-accent/50">
      <span className="text-[7px] uppercase leading-none tracking-widest text-muted">
        Lv
      </span>
      <span className="text-sm leading-none text-accent">{level}</span>
    </span>
  );
}

/**
 * Mobile navigation: a sticky top bar with a hamburger that opens a drawer.
 *
 * Deliberately NOT a fixed bottom bar. A bottom-anchored fixed element has to be
 * repositioned on every scroll frame while the mobile URL bar collapses, which is
 * what Marko saw as flicker on his phone; the top of the viewport doesn't move.
 */
function MobileNav({
  summary,
  onSignOut,
  onAddTask,
}: {
  summary: ReturnType<typeof useLevelSummary>;
  onSignOut: () => void;
  onAddTask: () => void;
}) {
  const pathname = usePathname();
  const session = useRunningSession();

  // The drawer is open for one route at a time. Links close it on tap; keying the
  // state to a pathname is the backstop for any navigation that doesn't go through
  // them, and keeps it shut without a setState-in-effect (which the lint config bans).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (next: boolean) => setOpenFor(next ? pathname : null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenFor(null);
    }
    document.addEventListener("keydown", onKeyDown);

    // Lock the page behind the drawer so the backdrop doesn't scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-edge bg-panel px-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded text-fg transition-colors active:bg-panel-2"
        >
          <span aria-hidden className="flex h-3.5 w-5 flex-col justify-between">
            <span className="block h-0.5 rounded-full bg-current" />
            <span className="block h-0.5 rounded-full bg-current" />
            <span className="block h-0.5 rounded-full bg-current" />
          </span>
        </button>

        {/* The wordmark yields to the timer — at 375px both don't fit. */}
        {!session && (
          <span className="text-xs font-light uppercase tracking-[0.3em] text-accent">
            Astrameath
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {session && <TopBarTimer session={session} />}
          <button
            onClick={onAddTask}
            aria-label="Add task"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded border border-edge text-xl leading-none text-accent transition-colors active:bg-panel-2"
          >
            +
          </button>
          {summary && (
            <Link href="/profile" aria-label={`Profile — level ${summary.level}`}>
              <LevelBadge level={summary.level} />
            </Link>
          )}
        </div>
      </header>

      {/* Kept mounted so it slides both ways; inert when closed so its links stay
          out of the tab order and off screen readers. Closed it is `invisible`, so
          no transparent fixed layer sits over every page — and the visibility flip
          is delayed by the length of the slide, so the close animation still plays. */}
      <div
        className={`fixed inset-0 z-40 transition-[visibility] duration-0 md:hidden ${
          open ? "visible" : "invisible pointer-events-none delay-200"
        }`}
        inert={!open}
      >
        {/* Backdrop: a tap target, but not an announced one — Escape and the ✕
            are the accessible ways out, and a second "Close menu" button would
            just be noise in the screen-reader tree. */}
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-edge bg-panel transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-edge px-4">
            <span className="text-sm font-light uppercase tracking-[0.3em] text-accent">
              Astrameath
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="-mr-2 inline-flex size-11 items-center justify-center rounded text-muted transition-colors active:bg-panel-2"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded px-3 text-base transition-colors ${
                    active
                      ? "bg-panel-2 text-accent"
                      : "text-muted active:bg-panel-2"
                  }`}
                >
                  <span aria-hidden className="w-5 text-center">
                    {item.glyph}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {summary && (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-edge bg-panel-2 px-3 py-3"
            >
              <LevelBadge level={summary.level} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-fg">
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

          <button
            onClick={onSignOut}
            className="mx-3 mb-4 min-h-12 rounded px-3 text-left text-sm text-muted transition-colors active:bg-panel-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const summary = useLevelSummary();
  const [addOpen, setAddOpen] = useState(false);

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
        <div className="px-5 pb-4 pt-6">
          <span className="text-sm font-light uppercase tracking-[0.3em] text-accent">
            Astrameath
          </span>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-2 rounded border border-edge px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg"
          >
            <span aria-hidden className="text-base leading-none text-accent">
              +
            </span>
            Add task
          </button>
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

      <MobileNav
        summary={summary}
        onSignOut={signOut}
        onAddTask={() => setAddOpen(true)}
      />

      {addOpen && <QuickAddTask onClose={() => setAddOpen(false)} />}
    </>
  );
}
