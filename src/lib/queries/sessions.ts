"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import { elapsedSeconds, MAX_SESSION_SECONDS } from "@/lib/time";

export type TimeSession = Tables<"time_sessions">;

export type ActiveSession = TimeSession & {
  tasks: { title: string; project_id: string } | null;
};

const TIME_KEYS = [["active-session"], ["task-time"], ["project-time"], ["xp"]];

function invalidateTime(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId?: string
) {
  for (const key of TIME_KEYS) queryClient.invalidateQueries({ queryKey: key });
  if (taskId)
    queryClient.invalidateQueries({ queryKey: ["task-sessions", taskId] });
}

export function useActiveSession() {
  return useQuery({
    queryKey: ["active-session"],
    queryFn: async (): Promise<ActiveSession | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_sessions")
        .select("*, tasks(title, project_id)")
        .is("ended_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Stops any running session first (DB allows only one), then starts the new one. */
export function useStartTimer() {
  const queryClient = useQueryClient();
  const stop = useStopTimer();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await stop.mutateAsync().catch(() => {}); // no-op when nothing is running
      const supabase = createClient();
      const { error } = await supabase
        .from("time_sessions")
        .insert({ task_id: taskId, source: "timer" });
      if (error) throw error;
      // a task being timed is being worked on
      await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", taskId)
        .eq("status", "todo");
    },
    onSuccess: (_data, taskId) => {
      invalidateTime(queryClient, taskId);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/**
 * Ends the running session. Sessions past the 12h cap are discarded entirely
 * (a forgotten timer, not real work) — same rule V1 landed on.
 * Resolves with the outcome so the UI can explain a discard.
 */
export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<"saved" | "discarded" | "idle"> => {
      const supabase = createClient();
      const { data: active, error } = await supabase
        .from("time_sessions")
        .select("id, task_id, started_at")
        .is("ended_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!active) return "idle";

      if (elapsedSeconds(active.started_at) > MAX_SESSION_SECONDS) {
        const { error: delError } = await supabase
          .from("time_sessions")
          .delete()
          .eq("id", active.id);
        if (delError) throw delError;
        return "discarded";
      }

      const { error: endError } = await supabase
        .from("time_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", active.id);
      if (endError) throw endError;
      return "saved";
    },
    onSuccess: () => invalidateTime(queryClient),
  });
}

export function useTaskSessions(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["task-sessions", taskId],
    enabled,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_sessions")
        .select("*")
        .eq("task_id", taskId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useAddManualSession(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      minutes,
      date,
      note,
    }: {
      minutes: number;
      date: string; // yyyy-mm-dd
      note?: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      // today: the entry ends now; past days: anchor at midday
      const end =
        date === today ? new Date() : new Date(`${date}T12:00:00`);
      const start = new Date(end.getTime() - minutes * 60_000);

      const supabase = createClient();
      const { error } = await supabase.from("time_sessions").insert({
        task_id: taskId,
        source: "manual",
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateTime(queryClient, taskId),
  });
}

export function useDeleteSession(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("time_sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => invalidateTime(queryClient, taskId),
  });
}
