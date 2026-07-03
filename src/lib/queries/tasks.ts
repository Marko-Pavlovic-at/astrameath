"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

export type Task = Tables<"tasks">;

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at");
      if (error) throw error;
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
    },
  });
}
