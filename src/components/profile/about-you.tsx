"use client";

import { useState } from "react";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";

/** Whole years since a "YYYY-MM-DD" birthdate. */
function ageFrom(birthdate: string): number | null {
  const [y, m, d] = birthdate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : null;
}

const fieldCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

/**
 * The "person" half of the character sheet — optional age/height/weight/bio.
 * Renders embedded inside the profile hero card (no heading of its own). All
 * optional; feeds the companion's person snapshot server-side.
 */
export default function AboutYou() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [open, setOpen] = useState(false);
  const [birthdate, setBirthdate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bio, setBio] = useState("");

  if (!profile) return null;

  function startEditing() {
    if (!profile) return;
    setBirthdate(profile.birthdate ?? "");
    setHeight(profile.height_cm ? String(profile.height_cm) : "");
    setWeight(profile.weight_kg ? String(profile.weight_kg) : "");
    setBio(profile.bio ?? "");
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
      { onSuccess: () => setOpen(false) }
    );
  }

  const age = profile.birthdate ? ageFrom(profile.birthdate) : null;
  const facts = [
    age != null ? `${age}` : null,
    profile.height_cm ? `${profile.height_cm} cm` : null,
    profile.weight_kg ? `${profile.weight_kg} kg` : null,
  ].filter(Boolean);
  const hasAny = facts.length > 0 || profile.bio;

  if (open) {
    return (
      <form onSubmit={save} className="space-y-3">
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
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 text-sm text-muted">
        {facts.length > 0 && <p>{facts.join(" · ")}</p>}
        {profile.bio && <p className="mt-1 text-fg">{profile.bio}</p>}
        {!hasAny && (
          <p className="italic">
            No personal details yet — your companions would love to know you.
          </p>
        )}
      </div>
      <button
        onClick={startEditing}
        className="shrink-0 text-xs text-accent hover:underline"
      >
        {hasAny ? "Edit" : "Add"}
      </button>
    </div>
  );
}
