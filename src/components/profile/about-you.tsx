"use client";

import { useState } from "react";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";

const fieldCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

/**
 * Optional personal data (age via birthdate, height, weight, a short bio). All
 * optional; feeds the companion's "person snapshot" server-side so it knows who
 * it's talking to. Weight is a single current value — a weight history is a
 * separate, deferred feature.
 */
export default function AboutYou() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [open, setOpen] = useState(false);
  const [birthdate, setBirthdate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  function startEditing() {
    if (!profile) return;
    setBirthdate(profile.birthdate ?? "");
    setHeight(profile.height_cm ? String(profile.height_cm) : "");
    setWeight(profile.weight_kg ? String(profile.weight_kg) : "");
    setBio(profile.bio ?? "");
    setSaved(false);
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      {
        birthdate: birthdate || null,
        height_cm: height ? Math.max(1, parseInt(height, 10)) : null,
        weight_kg: weight ? Math.max(1, parseFloat(weight)) : null,
        bio: bio.trim() || null,
      },
      { onSuccess: () => setSaved(true) }
    );
  }

  if (!profile) return null;

  const hasAny =
    profile.birthdate || profile.height_cm || profile.weight_kg || profile.bio;

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-widest text-muted">About you</h2>
        {!open && (
          <button
            onClick={startEditing}
            className="text-xs text-accent hover:underline"
          >
            {hasAny ? "Edit" : "Add"}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Optional. Shared with your companions so they know who they&apos;re
        talking to — nothing here is required.
      </p>

      {open ? (
        <form
          onSubmit={save}
          className="mt-3 space-y-3 rounded-lg border border-edge bg-panel p-4"
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Birthdate
              <input
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthdate(e.target.value)}
                className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Height (cm)
              <input
                type="number"
                min={1}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-28 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Weight (kg)
              <input
                type="number"
                min={1}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-28 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            About me
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Anything you want your companions to know about you…"
              className={fieldCls}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="rounded border border-accent/40 px-4 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-edge px-4 py-1.5 text-sm text-muted hover:text-fg"
            >
              Close
            </button>
            {saved && <span className="text-xs text-muted">Saved.</span>}
          </div>
        </form>
      ) : (
        hasAny && (
          <p className="mt-2 text-sm text-muted">
            {[
              profile.birthdate ? `Born ${profile.birthdate}` : null,
              profile.height_cm ? `${profile.height_cm} cm` : null,
              profile.weight_kg ? `${profile.weight_kg} kg` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            {profile.bio && (
              <span className="mt-1 block text-fg">{profile.bio}</span>
            )}
          </p>
        )
      )}
    </div>
  );
}
