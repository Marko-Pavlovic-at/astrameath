import type { Json } from "@/lib/supabase/types";

/**
 * Joyland-style character template, stored in companions.persona (jsonb).
 * All fields are plain text; greeting/scenario/example_dialogs support
 * {{char}} and {{user}} placeholders.
 */
export type Persona = {
  tagline: string; // one-line hook, shown on the companion card
  personality: string; // long-form: who they are, voice, traits
  backstory: string; // their history before now — where they come from, what shaped them
  greeting: string; // the character's first message
  scenario: string; // setting + how they relate to the user
  example_dialogs: string; // "{{user}}: …\n{{char}}: …" pairs, blank-line separated
};

export const EMPTY_PERSONA: Persona = {
  tagline: "",
  personality: "",
  backstory: "",
  greeting: "",
  scenario: "",
  example_dialogs: "",
};

export function parsePersona(value: Json | null | undefined): Persona {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PERSONA };
  }
  const v = value as Record<string, Json | undefined>;
  const str = (x: Json | undefined) => (typeof x === "string" ? x : "");
  return {
    tagline: str(v.tagline),
    personality: str(v.personality),
    backstory: str(v.backstory),
    greeting: str(v.greeting),
    scenario: str(v.scenario),
    example_dialogs: str(v.example_dialogs),
  };
}

/** Replace {{char}} / {{user}} placeholders (case-insensitive). */
export function fillTemplate(
  text: string,
  charName: string,
  userName: string
): string {
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName || "you");
}
