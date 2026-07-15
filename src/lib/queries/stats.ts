"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { StatKind } from "@/lib/stats";
import type { StatsSession } from "@/lib/time-stats";

/**
 * Every finished session, oldest first. Since Stage 1.5 the session carries its
 * project directly (project_id), so task-less project-level and imported time are
 * included. One user, short sessions — the full history aggregates client-side.
 */
export function useStatsSessions() {
  return useQuery({
    queryKey: ["stats-sessions"],
    queryFn: async (): Promise<StatsSession[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_sessions")
        .select("started_at, ended_at, project_id")
        .not("ended_at", "is", null)
        .order("started_at");
      if (error) throw error;
      return data.map((row) => ({
        startedAt: row.started_at,
        endedAt: row.ended_at as string, // filtered non-null above
        projectId: row.project_id,
      }));
    },
  });
}

export type StatsXpEvent = { stat: StatKind; amount: number; createdAt: string };

/** All XP events for the stats page — bucketed by local date client-side. */
export function useStatsXpEvents() {
  return useQuery({
    queryKey: ["stats-xp-events"],
    queryFn: async (): Promise<StatsXpEvent[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("xp_events")
        .select("stat, amount, created_at")
        .order("created_at");
      if (error) throw error;
      return data.map((row) => ({
        stat: row.stat,
        amount: Number(row.amount),
        createdAt: row.created_at,
      }));
    },
  });
}
