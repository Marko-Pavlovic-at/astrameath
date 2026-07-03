"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useXpTotals } from "@/lib/queries/xp";
import { STAT_ORDER, type StatKind } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { generalLevel, levelFromXp, type LevelInfo } from "@/lib/xp";

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
  };
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
        {summary && (
          <Link
            href="/profile"
            className="mx-3 mb-3 flex items-center gap-3 rounded border border-edge bg-panel-2 px-3 py-2 transition-colors hover:border-accent/40"
          >
            <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-full border border-accent/50">
              <span className="text-[7px] uppercase tracking-widest text-muted">
                Lv
              </span>
              <span className="text-sm leading-none text-accent">
                {summary.level}
              </span>
            </span>
            <span className="min-w-0 text-xs text-muted">
              <span className="block truncate text-fg">
                {summary.totalXp.toLocaleString()} XP
              </span>
              lifetime
            </span>
          </Link>
        )}
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
        <button
          onClick={signOut}
          className="mx-3 mb-4 rounded px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg"
        >
          Sign out
        </button>
      </aside>

      {/* Mobile bottom nav — the Profile glyph doubles as the level badge */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-edge bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
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
