"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveSession, useStopTimer } from "@/lib/queries/sessions";
import { elapsedSeconds, formatClock } from "@/lib/time";

export default function TimerBar() {
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
    <div className="fixed inset-x-3 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-accent/40 bg-panel px-4 py-2.5 shadow-lg shadow-black/40 md:hidden">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
      <Link
        href={
          session.tasks ? `/projects/${session.tasks.project_id}` : "/projects"
        }
        className="min-w-0 flex-1 truncate text-sm"
      >
        {session.tasks?.title ?? "Tracking"}
      </Link>
      <span className="font-mono text-sm text-accent">
        {formatClock(elapsedSeconds(session.started_at))}
      </span>
      <button
        onClick={onStop}
        disabled={stopTimer.isPending}
        className="shrink-0 rounded border border-danger/60 px-2.5 py-1 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
      >
        ■ Stop
      </button>
    </div>
  );
}
