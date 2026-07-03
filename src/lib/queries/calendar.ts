"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/queries/tasks";
import type { Tables, TablesUpdate } from "@/lib/supabase/types";

export type TaskCompletion = Tables<"task_completions">;

/** Dated tasks inside [start, end] plus every recurring template. */
export function useCalendarTasks(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: ["calendar-tasks", start, end],
    enabled,
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .or(
          `recurrence.not.is.null,and(scheduled_date.gte.${start},scheduled_date.lte.${end})`
        )
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Unscheduled, non-recurring, not-done tasks — the calendar sidebar pool. */
export function useUndatedTasks() {
  return useQuery({
    queryKey: ["undated-tasks"],
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("scheduled_date", null)
        .is("recurrence", null)
        .neq("status", "done")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useCompletions(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: ["completions", start, end],
    enabled,
    queryFn: async (): Promise<TaskCompletion[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_completions")
        .select("*")
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      return data;
    },
  });
}

/** Check / uncheck one day's occurrence of a recurring task. Optimistic. */
export function useToggleCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      date,
      completed,
    }: {
      taskId: string;
      date: string;
      completed: boolean;
    }) => {
      const supabase = createClient();
      if (completed) {
        const { error } = await supabase
          .from("task_completions")
          .insert({ task_id: taskId, date });
        // 23505 = unique (task_id, date) — already checked, treat as no-op
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("task_completions")
          .delete()
          .eq("task_id", taskId)
          .eq("date", date);
        if (error) throw error;
      }
    },
    onMutate: async ({ taskId, date, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["completions"] });
      const snapshots = queryClient.getQueriesData({
        queryKey: ["completions"],
      });
      queryClient.setQueriesData<TaskCompletion[]>(
        { queryKey: ["completions"] },
        (rows) => {
          if (!rows) return rows;
          const rest = rows.filter(
            (r) => !(r.task_id === taskId && r.date === date)
          );
          if (!completed) return rest;
          return [
            ...rest,
            {
              id: `optimistic-${taskId}-${date}`,
              user_id: "",
              task_id: taskId,
              date,
              completed_at: new Date().toISOString(),
            },
          ];
        }
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? [])
        queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

/**
 * Set or clear a task's calendar slot (drag-and-drop / sidebar date pick).
 * Omit `time` to leave scheduled_time untouched (e.g. dragging to another day).
 */
export function useScheduleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      date,
      time,
    }: {
      id: string;
      date: string | null;
      time?: string | null;
    }) => {
      const supabase = createClient();
      const patch: TablesUpdate<"tasks"> = { scheduled_date: date };
      if (time !== undefined) patch.scheduled_time = time;
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/** Toggle a one-off task done/todo from the calendar. Optimistic. */
export function useSetTaskDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update(
          done
            ? { status: "done", completed_at: new Date().toISOString() }
            : { status: "todo", completed_at: null }
        )
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ["calendar-tasks"] });
      const snapshots = queryClient.getQueriesData({
        queryKey: ["calendar-tasks"],
      });
      queryClient.setQueriesData<Task[]>(
        { queryKey: ["calendar-tasks"] },
        (tasks) =>
          tasks?.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: done ? ("done" as const) : ("todo" as const),
                  completed_at: done ? new Date().toISOString() : null,
                }
              : t
          )
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? [])
        queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["undated-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}
