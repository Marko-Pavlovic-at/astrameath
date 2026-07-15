"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProjects } from "@/lib/queries/projects";
import { useQuickAddTask } from "@/lib/queries/tasks";
import { STATS } from "@/lib/stats";

const LAST_PROJECT_KEY = "quickadd:lastProject";

/**
 * App-wide quick-add task modal. Mounted (only while open) by the nav and opened
 * by a "+" that exists at every width — sidebar on desktop, top bar on mobile —
 * so a task can be captured from any route, not only inside a project page.
 *
 * A task requires a project (no inbox — that would mean a schema change), so the
 * picker defaults to the last one used, remembered in localStorage. The parent
 * mounts this fresh each open, so form state seeds from `useState` with no
 * setState-in-effect (which the lint config bans).
 */
export default function QuickAddTask({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const quickAdd = useQuickAddTask();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  // null → follow the derived default (last-used / first project); a string is an
  // explicit user pick that sticks even as projects finish loading.
  const [chosenProject, setChosenProject] = useState<string | null>(null);

  // Escape to close + body-scroll lock. No setState here, so it's lint-safe.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const remembered =
    typeof window !== "undefined"
      ? window.localStorage.getItem(LAST_PROJECT_KEY)
      : null;
  const defaultProjectId =
    projects?.find((p) => p.id === remembered)?.id ?? projects?.[0]?.id ?? "";
  const projectId = chosenProject ?? defaultProjectId;

  const noProjects = projects && projects.length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    window.localStorage.setItem(LAST_PROJECT_KEY, projectId);
    quickAdd.mutate(
      { projectId, title: title.trim(), scheduled_date: date || null },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        className="relative w-full max-w-md rounded-xl border border-edge bg-panel p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted">
          Add task
        </h2>

        {noProjects ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              You need a project first — tasks live inside one.
            </p>
            <Link
              href="/projects"
              onClick={onClose}
              className="inline-flex rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
            >
              Go to Projects
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent"
              aria-label="Task title"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={projectId}
                onChange={(e) => setChosenProject(e.target.value)}
                className="min-h-11 min-w-40 flex-1 rounded border border-edge bg-panel-2 px-2 text-fg outline-none focus:border-accent sm:min-h-0 sm:py-2"
                aria-label="Project"
              >
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {STATS[p.stat].glyph} {p.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 rounded border border-edge bg-panel-2 px-2 text-fg outline-none focus:border-accent sm:min-h-0 sm:py-2"
                aria-label="Scheduled date (optional)"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={quickAdd.isPending || !title.trim() || !projectId}
                className="rounded border border-accent/40 px-4 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                {quickAdd.isPending ? "Adding…" : "Add task"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-edge px-4 py-1.5 text-sm text-muted hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
