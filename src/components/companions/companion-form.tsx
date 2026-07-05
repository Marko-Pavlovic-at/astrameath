"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parsePersona, type Persona } from "@/lib/ai/persona";
import {
  uploadAvatar,
  useCompanion,
  useCreateCompanion,
  useDeleteCompanion,
  useUpdateCompanion,
} from "@/lib/queries/companions";
import { useProfile } from "@/lib/queries/profile";
import { Avatar } from "./companions-view";

const FIELD_CLS =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted">
        {label}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/** Joyland-style character template — one form for create and edit. */
export default function CompanionForm({ id }: { id?: string }) {
  const router = useRouter();
  const { data: existing } = useCompanion(id ?? "", Boolean(id));
  const { data: profile } = useProfile();
  const create = useCreateCompanion();
  const update = useUpdateCompanion();
  const remove = useDeleteCompanion();

  const editing = Boolean(id);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona>({
    tagline: "",
    personality: "",
    backstory: "",
    greeting: "",
    scenario: "",
    example_dialogs: "",
  });
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  // hydrate once when editing
  if (editing && existing && !loaded) {
    setName(existing.name);
    setAvatarUrl(existing.avatar_url);
    setPersona(parsePersona(existing.persona));
    setLoaded(true);
  }
  if (editing && !existing) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const set = (key: keyof Persona) => (value: string) =>
    setPersona((p) => ({ ...p, [key]: value }));

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setAvatarUrl(await uploadAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !persona.personality.trim()) return;
    setError("");
    try {
      if (editing && id) {
        await update.mutateAsync({ id, name: name.trim(), avatarUrl, persona });
        router.push(`/companions/${id}`);
      } else {
        const companion = await create.mutateAsync({
          name: name.trim(),
          avatarUrl,
          persona,
          userName: profile?.display_name ?? "",
        });
        router.push(`/companions/${companion.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteCompanion() {
    if (!id) return;
    await remove.mutateAsync(id);
    router.push("/companions");
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl uppercase tracking-widest">
          {editing ? `Edit ${name || "companion"}` : "New companion"}
        </h1>
        <Link
          href={editing && id ? `/companions/${id}` : "/companions"}
          className="text-sm text-muted hover:text-fg"
        >
          Cancel
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Write in second person (&quot;You are…&quot;). {"{{char}}"} and{" "}
        {"{{user}}"} are replaced with the character&apos;s and your name.
      </p>

      <form onSubmit={save} className="mt-5 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar url={avatarUrl} name={name} size="size-16 text-2xl" />
          <label className="cursor-pointer rounded border border-edge px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg">
            {uploading ? "Uploading…" : avatarUrl ? "Change avatar" : "Upload avatar"}
            <input
              type="file"
              accept="image/*"
              onChange={pickAvatar}
              className="hidden"
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              className="text-xs text-muted hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={FIELD_CLS}
            placeholder="Nyx"
          />
        </Field>

        <Field label="Tagline" hint="One line shown on the companion card.">
          <input
            value={persona.tagline}
            onChange={(e) => set("tagline")(e.target.value)}
            className={FIELD_CLS}
            placeholder="A sharp-tongued star cartographer who pretends not to care"
          />
        </Field>

        <Field
          label="Personality"
          hint="The core of the character: who they are, how they speak, what they want. The more specific, the better they hold their voice."
        >
          <textarea
            value={persona.personality}
            onChange={(e) => set("personality")(e.target.value)}
            required
            rows={10}
            className={FIELD_CLS}
            placeholder={`{{char}} is a 300-year-old star cartographer…\n\nVoice: dry, precise, allergic to sentimentality. Short sentences.\nNever says: "as an AI", modern slang.`}
          />
        </Field>

        <Field
          label="Backstory"
          hint="Their history before now — where they come from, what shaped them. They draw on it when it comes up, without reciting it."
        >
          <textarea
            value={persona.backstory}
            onChange={(e) => set("backstory")(e.target.value)}
            rows={6}
            className={FIELD_CLS}
            placeholder={`Born under a dead constellation, {{char}} charted skies for an empire that no longer exists…`}
          />
        </Field>

        <Field
          label="Greeting"
          hint="The character's first message when the chat begins."
        >
          <textarea
            value={persona.greeting}
            onChange={(e) => set("greeting")(e.target.value)}
            rows={3}
            className={FIELD_CLS}
            placeholder={`*{{char}} looks up from a half-drawn map* You're late, {{user}}.`}
          />
        </Field>

        <Field
          label="Scenario"
          hint="The setting and how the character relates to you."
        >
          <textarea
            value={persona.scenario}
            onChange={(e) => set("scenario")(e.target.value)}
            rows={3}
            className={FIELD_CLS}
            placeholder="{{char}} watches over {{user}}'s training from an observatory between worlds…"
          />
        </Field>

        <Field
          label="Example dialogs"
          hint={`A few short exchanges that pin the voice. Format:\n{{user}}: … / {{char}}: …`}
        >
          <textarea
            value={persona.example_dialogs}
            onChange={(e) => set("example_dialogs")(e.target.value)}
            rows={6}
            className={FIELD_CLS}
            placeholder={`{{user}}: I skipped training today.\n{{char}}: *doesn't look up* The stars skipped nothing. Try again tomorrow.`}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={create.isPending || update.isPending || uploading}
            className="rounded border border-accent/40 px-4 py-2 text-sm uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {editing ? "Save changes" : "Create companion"}
          </button>

          {editing &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted">
                  Delete forever — chat, memories, everything?
                </span>
                <button
                  type="button"
                  onClick={deleteCompanion}
                  className="rounded border border-danger/50 px-2 py-1 text-danger hover:bg-danger/10"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-muted hover:text-fg"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-muted transition-colors hover:text-danger"
              >
                Delete companion
              </button>
            ))}
        </div>
      </form>
    </section>
  );
}
