"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCreateProject,
  useProjects,
  useProjectTimeTotals,
} from "@/lib/queries/projects";
import { STAT_ORDER, STATS, type StatKind } from "@/lib/stats";
import { formatDuration } from "@/lib/time";

const inputCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

export default function ProjectsView() {
  const { data: projects, isLoading } = useProjects();
  const { data: timeTotals } = useProjectTimeTotals();
  const createProject = useCreateProject();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [stat, setStat] = useState<StatKind>("discipline");
  const [description, setDescription] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject.mutateAsync({
      name: name.trim(),
      stat,
      description: description.trim() || null,
    });
    setName("");
    setDescription("");
    setCreating(false);
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl uppercase tracking-widest">Projects</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded border border-accent/40 px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10"
        >
          {creating ? "Cancel" : "+ New project"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={onCreate}
          className="mt-4 space-y-3 rounded-lg border border-edge bg-panel p-4"
        >
          <input
            autoFocus
            placeholder="Name (e.g. Health, Work…)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
          <div className="flex flex-wrap gap-2">
            {STAT_ORDER.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStat(s)}
                style={stat === s ? { borderColor: STATS[s].color } : undefined}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  stat === s
                    ? "bg-panel-2 text-fg"
                    : "border-edge text-muted hover:text-fg"
                }`}
              >
                <span style={{ color: STATS[s].color }}>{STATS[s].glyph}</span>{" "}
                {STATS[s].label}
              </button>
            ))}
          </div>
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={createProject.isPending}
            className="rounded border border-accent/40 px-4 py-2 text-sm uppercase tracking-widest text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : projects && projects.length > 0 ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-lg border border-edge bg-panel p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: STATS[p.stat].color }}
                  >
                    {STATS[p.stat].glyph} {STATS[p.stat].label}
                  </span>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {p.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {formatDuration(timeTotals?.[p.id] ?? 0)} tracked
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">
          No projects yet. Create one for each area of your life you want to
          level up.
        </p>
      )}
    </section>
  );
}
