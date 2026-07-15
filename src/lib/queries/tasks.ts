"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

export type Subtask = Tables<"subtasks">;
/** Bare task row — used by the calendar/recurrence layer, which never needs subtasks. */
export type TaskRow = Tables<"tasks">;
/** A task with its subtasks nested — used in project detail. */
export type Task = TaskRow & { subtasks: Subtask[] };

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*, subtasks(*)")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at");
      if (error) throw error;
      for (const t of data) {
        t.subtasks.sort(
          (a, b) =>
            a.position - b.position || a.created_at.localeCompare(b.created_at)
        );
      }
      return data;
    },
  });
}

/** task_id → total tracked seconds (finished sessions only). */
export function useTaskTimeTotals() {
  return useQuery({
    queryKey: ["task-time"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_time_totals")
        .select("*");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data) {
        if (row.task_id) map[row.task_id] = row.total_seconds ?? 0;
      }
      return map;
    },
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<TablesInsert<"tasks">, "project_id">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
    },
  });
}

/**
 * Global quick-add — like useCreateTask but the project is a per-call argument,
 * so one hook instance serves the app-wide add-task modal (which isn't scoped to
 * a project page). Invalidates the target project's task list plus the calendar.
 */
export function useQuickAddTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      ...task
    }: Omit<TablesInsert<"tasks">, "project_id"> & { projectId: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: TablesUpdate<"tasks"> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task-time"] });
      queryClient.invalidateQueries({ queryKey: ["project-time"] });
      queryClient.invalidateQueries({ queryKey: ["active-session"] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

/**
 * Subtasks are nested inside the ["tasks", projectId] query, so every subtask
 * mutation just re-fetches that key. They award no XP — no ["xp"] invalidation.
 */
function useSubtaskMutation<TVars>(
  projectId: string,
  mutationFn: (vars: TVars) => Promise<void>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

export function useCreateSubtask(projectId: string) {
  return useSubtaskMutation(
    projectId,
    async ({ taskId, title }: { taskId: string; title: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("subtasks")
        .insert({ task_id: taskId, title });
      if (error) throw error;
    }
  );
}

export function useSetSubtaskCompleted(projectId: string) {
  return useSubtaskMutation(
    projectId,
    async ({ id, completed }: { id: string; completed: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("subtasks")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    }
  );
}

export function useDeleteSubtask(projectId: string) {
  return useSubtaskMutation(projectId, async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("subtasks").delete().eq("id", id);
    if (error) throw error;
  });
}
