"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

export type Project = Tables<"projects">;

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("archived_at", null)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** project_id → total tracked seconds (finished sessions only). */
export function useProjectTimeTotals() {
  return useQuery({
    queryKey: ["project-time"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_time_totals")
        .select("*");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data) {
        if (row.project_id) map[row.project_id] = row.total_seconds ?? 0;
      }
      return map;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: TablesInsert<"projects">) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .insert(project)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: TablesUpdate<"projects"> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/** Hard delete — cascades tasks and their sessions. Caller confirms first. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
