"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export type Milestone = Tables<"milestones">;
export type Goal = Tables<"goals"> & { milestones: Milestone[] };

export function useGoals(projectId: string) {
  return useQuery({
    queryKey: ["goals", projectId],
    queryFn: async (): Promise<Goal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("goals")
        .select("*, milestones(*)")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at");
      if (error) throw error;
      for (const g of data) {
        g.milestones.sort(
          (a, b) =>
            a.position - b.position || a.created_at.localeCompare(b.created_at)
        );
      }
      return data;
    },
  });
}

/** Goal + milestone completions award XP via DB triggers → invalidate ["xp"]. */
function useGoalMutation<TVars>(
  projectId: string,
  mutationFn: (vars: TVars) => Promise<void>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

export function useCreateGoal(projectId: string) {
  return useGoalMutation(
    projectId,
    async ({ title, deadline }: { title: string; deadline: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("goals")
        .insert({ project_id: projectId, title, deadline });
      if (error) throw error;
    }
  );
}

export function useSetGoalCompleted(projectId: string) {
  return useGoalMutation(
    projectId,
    async ({ id, completed }: { id: string; completed: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("goals")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    }
  );
}

export function useDeleteGoal(projectId: string) {
  return useGoalMutation(projectId, async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
  });
}

export function useCreateMilestone(projectId: string) {
  return useGoalMutation(
    projectId,
    async ({
      goalId,
      title,
      deadline,
    }: {
      goalId: string;
      title: string;
      deadline: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("milestones")
        .insert({ goal_id: goalId, title, deadline });
      if (error) throw error;
    }
  );
}

export function useSetMilestoneCompleted(projectId: string) {
  return useGoalMutation(
    projectId,
    async ({ id, completed }: { id: string; completed: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("milestones")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    }
  );
}

export function useDeleteMilestone(projectId: string) {
  return useGoalMutation(projectId, async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("milestones").delete().eq("id", id);
    if (error) throw error;
  });
}
