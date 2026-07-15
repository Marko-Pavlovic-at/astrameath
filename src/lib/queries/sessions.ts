"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";
import { elapsedSeconds, MAX_SESSION_SECONDS } from "@/lib/time";

export type TimeSession = Tables<"time_sessions">;

export type ActiveSession = TimeSession & {
  tasks: { title: string; project_id: string } | null;
};

/** A finished session with its task title (null for task-less project-level time). */
export type ProjectSession = TimeSession & { tasks: { title: string } | null };

// Prefix keys — invalidateQueries matches by prefix, so ["task-sessions"] clears
// every per-task list and ["project-sessions"] every per-project list at once.
const TIME_KEYS = [
  ["active-session"],
  ["task-time"],
  ["project-time"],
  ["stats-sessions"],
  ["xp"],
  ["task-sessions"],
  ["project-sessions"],
];

function invalidateTime(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of TIME_KEYS) queryClient.invalidateQueries({ queryKey: key });
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
    onSuccess: () => {
      invalidateTime(queryClient);
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

/** All finished sessions for a project — timer, manual and imported, task or not. */
export function useProjectSessions(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["project-sessions", projectId],
    enabled,
    queryFn: async (): Promise<ProjectSession[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_sessions")
        .select("*, tasks(title)")
        .eq("project_id", projectId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Adds a session directly against a project (no task). `source: "import"` backfills
 * historical hours from old apps — those never award XP (the DB trigger skips them);
 * `source: "manual"` is normal logged time and does award XP to the project's stat.
 */
export function useAddProjectSession(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      minutes,
      date,
      note,
      source,
    }: {
      minutes: number;
      date: string; // yyyy-mm-dd
      note?: string;
      source: "manual" | "import";
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      const end = date === today ? new Date() : new Date(`${date}T12:00:00`);
      const start = new Date(end.getTime() - minutes * 60_000);

      const supabase = createClient();
      const { error } = await supabase.from("time_sessions").insert({
        project_id: projectId,
        task_id: null,
        source,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateTime(queryClient),
  });
}

/** Edits a finished session's times/note. Changing the duration re-derives its XP. */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      started_at,
      ended_at,
      note,
    }: {
      id: string;
      started_at?: string;
      ended_at?: string;
      note?: string | null;
    }) => {
      const supabase = createClient();
      const patch: Partial<TimeSession> = {};
      if (started_at !== undefined) patch.started_at = started_at;
      if (ended_at !== undefined) patch.ended_at = ended_at;
      if (note !== undefined) patch.note = note;
      const { error } = await supabase
        .from("time_sessions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTime(queryClient),
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
    onSuccess: () => invalidateTime(queryClient),
  });
}

export function useDeleteSession() {
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
    onSuccess: () => invalidateTime(queryClient),
  });
}
