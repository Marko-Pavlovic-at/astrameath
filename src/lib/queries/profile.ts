"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesUpdate } from "@/lib/supabase/types";

export type Profile = Tables<"profiles">;

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"profiles">) => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", auth.user!.id);
      if (error) throw error;
    },
    // optimistic so title/theme picks feel instant
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["profile"] });
      const prev = queryClient.getQueryData<Profile>(["profile"]);
      if (prev) queryClient.setQueryData(["profile"], { ...prev, ...patch });
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["profile"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}
