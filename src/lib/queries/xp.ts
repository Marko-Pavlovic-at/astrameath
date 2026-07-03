"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { STAT_ORDER, type StatKind } from "@/lib/stats";

/** stat → lifetime XP (all six stats present, 0 when nothing earned yet). */
export function useXpTotals() {
  return useQuery({
    queryKey: ["xp"],
    queryFn: async (): Promise<Record<StatKind, number>> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("xp_totals").select("*");
      if (error) throw error;
      const map = Object.fromEntries(STAT_ORDER.map((s) => [s, 0])) as Record<
        StatKind,
        number
      >;
      for (const row of data) {
        if (row.stat) map[row.stat] = Number(row.total_xp ?? 0);
      }
      return map;
    },
  });
}
