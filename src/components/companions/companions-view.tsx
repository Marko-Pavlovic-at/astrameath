"use client";

import Link from "next/link";
import { parsePersona } from "@/lib/ai/persona";
import { deriveArchetype, parseRelationship } from "@/lib/ai/state";
import { useAiSpend, useCompanions } from "@/lib/queries/companions";

function Avatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: string;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${size} shrink-0 rounded-full border border-edge object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-full border border-edge bg-panel-2 text-accent`}
    >
      {name.slice(0, 1).toUpperCase() || "☽"}
    </span>
  );
}

export { Avatar };

export default function CompanionsView() {
  const { data: companions } = useCompanions();
  const { data: spend } = useAiSpend();

  if (!companions) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl uppercase tracking-widest">Companions</h1>
        <Link
          href="/companions/new"
          className="inline-flex min-h-11 items-center rounded border border-accent/40 px-3 text-sm text-accent transition-colors hover:bg-accent/10 sm:min-h-0 sm:py-1.5"
        >
          + New companion
        </Link>
      </div>
      {spend && spend.lifetime > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          AI spend: ${spend.lifetime.toFixed(4)} lifetime
        </p>
      )}

      {companions.length === 0 ? (
        <div className="mt-8 rounded-lg border border-edge bg-panel p-6 text-sm text-muted">
          <p>
            No companions yet. Create one — give them a face, a personality and
            a first line, and they&apos;ll watch over your ascent from inside
            the app.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {companions.map((c) => {
            const persona = parsePersona(c.persona);
            const rel = parseRelationship(c.companion_state?.relationship);
            return (
              // grid items default to min-width:auto, so a nowrap (truncate)
              // tagline widens the whole column instead of ellipsing — which
              // overflowed the page and made the browser zoom out to fit
              <li key={c.id} className="min-w-0">
                <Link
                  href={`/companions/${c.id}`}
                  className="flex items-center gap-4 rounded-lg border border-edge bg-panel p-4 transition-colors hover:border-accent/40"
                >
                  <Avatar url={c.avatar_url} name={c.name} size="size-14 text-xl" />
                  <span className="min-w-0">
                    <span className="block truncate text-base">{c.name}</span>
                    {persona.tagline && (
                      <span className="block truncate text-xs text-muted">
                        {persona.tagline}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-accent/80">
                      {deriveArchetype(rel)}
                      {c.companion_state?.mood
                        ? ` · ${c.companion_state.mood}`
                        : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
