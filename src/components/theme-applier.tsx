"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/queries/profile";
import { THEME_ACCENTS } from "@/lib/rewards";

/**
 * Applies the profile's active accent theme app-wide by setting
 * <html data-theme="...">. Renders nothing. Full theming pass is Phase 7 —
 * for now themes swap the accent color (see globals.css).
 */
export default function ThemeApplier() {
  const { data: profile } = useProfile();
  const theme = profile?.active_theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== "abyss" && theme in THEME_ACCENTS) {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
  }, [theme]);

  return null;
}
