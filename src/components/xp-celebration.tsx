"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { STAT_ORDER, type StatKind } from "@/lib/stats";
import { generalLevel, levelFromXp, type LevelInfo } from "@/lib/xp";

type XpMap = Record<StatKind, number>;

function summarize(xp: XpMap) {
  const statLevels = Object.fromEntries(
    STAT_ORDER.map((s) => [s, levelFromXp(xp[s])])
  ) as Record<StatKind, LevelInfo>;
  return {
    total: STAT_ORDER.reduce((a, s) => a + xp[s], 0),
    level: generalLevel(statLevels),
  };
}

let nextFloatId = 0;

/**
 * Global celebration layer (Phase 7): watches the shared ["xp"] cache and, when
 * the lifetime total climbs, floats a "+N XP" up near the top; when the general
 * level ticks up, drops a level-up banner. Reads the cache from a subscription
 * (not a synchronous effect body) so it stays clear of the setState-in-effect
 * lint rule, and the first observation just sets the baseline — no spurious
 * float on load. Only increases celebrate; revokes update the baseline silently.
 */
export default function XpCelebration() {
  const queryClient = useQueryClient();
  const prev = useRef<{ total: number; level: number } | null>(null);
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => {
    const cache = queryClient.getQueryCache();

    function read() {
      const xp = queryClient.getQueryData<XpMap>(["xp"]);
      if (!xp) return;
      const next = summarize(xp);
      const before = prev.current;
      prev.current = next;
      if (!before) return; // baseline

      if (next.total > before.total) {
        const id = ++nextFloatId;
        const amount = next.total - before.total;
        setFloats((f) => [...f, { id, amount }]);
        setTimeout(
          () => setFloats((f) => f.filter((x) => x.id !== id)),
          1200
        );
      }
      if (next.level > before.level) {
        setLevelUp(next.level);
        setTimeout(() => setLevelUp(null), 2600);
      }
    }

    read(); // seed the baseline from whatever is already cached
    return cache.subscribe(read);
  }, [queryClient]);

  return (
    <>
      <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 md:top-6">
        {floats.map((f) => (
          <div
            key={f.id}
            className="animate-xp-float text-center text-lg font-medium text-accent"
            style={{
              textShadow:
                "0 0 16px color-mix(in srgb, var(--accent) 60%, transparent)",
            }}
          >
            +{f.amount} XP
          </div>
        ))}
      </div>

      {levelUp !== null && (
        <button
          onClick={() => setLevelUp(null)}
          aria-label="Dismiss"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="glow animate-pop rounded-2xl border border-accent/50 bg-panel px-12 py-8 text-center">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-muted">
              Level Up
            </p>
            <p
              className="mt-2 font-display text-6xl text-accent"
              style={{
                textShadow:
                  "0 0 30px color-mix(in srgb, var(--accent) 70%, transparent)",
              }}
            >
              {levelUp}
            </p>
            <p className="mt-1 text-xs text-muted">general level reached</p>
          </div>
        </button>
      )}
    </>
  );
}
