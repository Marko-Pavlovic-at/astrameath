"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const items = [
  { href: "/projects", label: "Projects", glyph: "◆" },
  { href: "/calendar", label: "Calendar", glyph: "◇" },
  { href: "/stats", label: "Stats", glyph: "▲" },
  { href: "/companions", label: "Companions", glyph: "☽" },
  { href: "/profile", label: "Profile", glyph: "✦" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

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
        <button
          onClick={signOut}
          className="mx-3 mb-4 rounded px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg"
        >
          Sign out
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-edge bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {item.glyph}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
