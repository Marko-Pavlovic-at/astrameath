"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Persona } from "@/lib/ai/persona";
import { fillTemplate } from "@/lib/ai/persona";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/types";

export type Companion = Tables<"companions">;
export type CompanionState = Tables<"companion_state">;
export type CompanionMessage = Tables<"companion_messages">;
export type CompanionWithState = Companion & {
  companion_state: Pick<
    CompanionState,
    "relationship" | "mood" | "last_seen_at"
  > | null;
};

export function useCompanions() {
  return useQuery({
    queryKey: ["companions"],
    queryFn: async (): Promise<CompanionWithState[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companions")
        .select("*, companion_state(relationship, mood, last_seen_at)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useCompanion(id: string, enabled = true) {
  return useQuery({
    queryKey: ["companions", id],
    enabled,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companions")
        .select("*, companion_state(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Companion & { companion_state: CompanionState | null };
    },
  });
}

export function useCompanionMessages(companionId: string) {
  return useQuery({
    queryKey: ["companion-messages", companionId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companion_messages")
        .select("*")
        .eq("companion_id", companionId)
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

/** Lifetime AI spend (USD) + per-companion breakdown, from the usage ledger. */
export function useAiSpend() {
  return useQuery({
    queryKey: ["ai-spend"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_usage")
        .select("companion_id, cost_usd");
      if (error) throw error;
      let lifetime = 0;
      const byCompanion: Record<string, number> = {};
      for (const row of data) {
        const usd = Number(row.cost_usd);
        lifetime += usd;
        if (row.companion_id) {
          byCompanion[row.companion_id] =
            (byCompanion[row.companion_id] ?? 0) + usd;
        }
      }
      return { lifetime, byCompanion };
    },
  });
}

/** Storage upload → public URL (bucket `avatars`, RLS: own folder only). */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export function useCreateCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      avatarUrl,
      persona,
      userName,
    }: {
      name: string;
      avatarUrl: string | null;
      persona: Persona;
      userName: string;
    }) => {
      const supabase = createClient();
      const { data: companion, error } = await supabase
        .from("companions")
        .insert({
          name,
          avatar_url: avatarUrl,
          persona: persona as unknown as Json,
        })
        .select()
        .single();
      if (error) throw error;

      // state row + the character's greeting as the first message
      const { error: stateError } = await supabase
        .from("companion_state")
        .insert({ companion_id: companion.id });
      if (stateError) throw stateError;
      if (persona.greeting.trim()) {
        const { error: msgError } = await supabase
          .from("companion_messages")
          .insert({
            companion_id: companion.id,
            role: "assistant",
            content: fillTemplate(persona.greeting.trim(), name, userName),
          });
        if (msgError) throw msgError;
      }
      return companion;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companions"] }),
  });
}

export function useUpdateCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      avatarUrl,
      persona,
    }: {
      id: string;
      name: string;
      avatarUrl: string | null;
      persona: Persona;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("companions")
        .update({
          name,
          avatar_url: avatarUrl,
          persona: persona as unknown as Json,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companions"] }),
  });
}

/** Hard delete — cascades state, messages and memories. Caller confirms. */
export function useDeleteCompanion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("companions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
