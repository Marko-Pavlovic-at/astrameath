"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { StatsSession } from "@/lib/time-stats";

/**
 * Every finished session, oldest first, with its project resolved through the
 * task. One user, short sessions — the full history is small enough to
 * aggregate client-side (the "All time" range needs it anyway).
 */
export function useStatsSessions() {
  return useQuery({
    queryKey: ["stats-sessions"],
    queryFn: async (): Promise<StatsSession[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_sessions")
        .select("started_at, ended_at, tasks(project_id)")
        .not("ended_at", "is", null)
        .order("started_at");
      if (error) throw error;
      return data.map((row) => ({
        startedAt: row.started_at,
        endedAt: row.ended_at as string, // filtered non-null above
        projectId: row.tasks?.project_id ?? null,
      }));
    },
  });
}
