"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import TaskRow from "@/components/projects/task-row";
import {
  useDeleteProject,
  useProject,
  useProjectTimeTotals,
  useUpdateProject,
} from "@/lib/queries/projects";
import { useActiveSession } from "@/lib/queries/sessions";
import { useCreateTask, useTasks, useTaskTimeTotals } from "@/lib/queries/tasks";
import {
  PRIORITIES,
  PRIORITY_ORDER,
  STAT_ORDER,
  STATS,
  STATUSES,
  type StatKind,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/stats";
import { formatDuration } from "@/lib/time";

const inputCls =
  "w-full rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent";

const STATUS_FILTERS: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "todo", label: STATUSES.todo.label },
  { value: "in_progress", label: STATUSES.in_progress.label },
  { value: "done", label: STATUSES.done.label },
];

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data: project, isLoading } = useProject(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: taskTime } = useTaskTimeTotals();
  const { data: projectTime } = useProjectTimeTotals();
  const { data: activeSession } = useActiveSession();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask(projectId);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stat, setStat] = useState<StatKind>("discipline");

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">(
    "all"
  );

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newEstimate, setNewEstimate] = useState("");

  const visibleTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  }, [tasks, statusFilter, priorityFilter]);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!project) return <p className="text-sm text-muted">Project not found.</p>;

  function startEditing() {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setStat(project.stat);
    setEditing(true);
  }

  function saveProject(e: React.FormEvent) {
    e.preventDefault();
    updateProject.mutate({
      id: projectId,
      name: name.trim() || project!.name,
      description: description.trim() || null,
      stat,
    });
    setEditing(false);
  }

  async function onDeleteProject() {
    if (
      confirm(
        `Delete project "${project!.name}" with all its tasks and tracked time? This cannot be undone.`
      )
    ) {
      await deleteProject.mutateAsync(projectId);
      router.push("/projects");
    }
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createTask.mutate({
      title: newTitle.trim(),
      priority: newPriority,
      estimate_minutes: newEstimate
        ? Math.max(1, parseInt(newEstimate, 10))
        : null,
    });
    setNewTitle("");
    setNewEstimate("");
  }

  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/projects" className="text-xs text-muted hover:text-fg">
        ← Projects
      </Link>

      {editing ? (
        <form
          onSubmit={saveProject}
          className="mt-3 space-y-3 rounded-lg border border-edge bg-panel p-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
            aria-label="Project name"
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded border border-accent/40 px-4 py-1.5 text-sm text-accent hover:bg-accent/10"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-edge px-4 py-1.5 text-sm text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteProject}
              className="ml-auto rounded border border-danger/40 px-4 py-1.5 text-sm text-danger hover:bg-danger/10"
            >
              Delete project
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl">{project.name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              <span style={{ color: STATS[project.stat].color }}>
                {STATS[project.stat].glyph} {STATS[project.stat].label}
              </span>
              <span>{formatDuration(projectTime?.[projectId] ?? 0)} tracked</span>
            </p>
            {project.description && (
              <p className="mt-2 text-sm text-muted">{project.description}</p>
            )}
          </div>
          <button
            onClick={startEditing}
            className="shrink-0 rounded border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
          >
            Edit
          </button>
        </div>
      )}

      <form onSubmit={addTask} className="mt-6 flex flex-wrap gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task…"
          className="min-w-40 flex-1 rounded border border-edge bg-panel-2 px-3 py-2 text-fg outline-none focus:border-accent"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
          className="rounded border border-edge bg-panel-2 px-2 py-2 text-fg outline-none focus:border-accent"
          aria-label="Priority"
        >
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITIES[p].label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={newEstimate}
          onChange={(e) => setNewEstimate(e.target.value)}
          placeholder="Est. min"
          className="w-24 rounded border border-edge bg-panel-2 px-2 py-2 text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={createTask.isPending}
          className="rounded border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded border px-2 py-1 transition-colors ${
              statusFilter === f.value
                ? "border-accent/40 text-accent"
                : "border-edge text-muted hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as TaskPriority | "all")
          }
          className="ml-auto rounded border border-edge bg-panel-2 px-2 py-1 text-muted outline-none focus:border-accent"
          aria-label="Filter by priority"
        >
          <option value="all">Any priority</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITIES[p].label}
            </option>
          ))}
        </select>
      </div>

      {visibleTasks.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {visibleTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              projectId={projectId}
              totalSeconds={taskTime?.[t.id] ?? 0}
              isTimerActive={activeSession?.task_id === t.id}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">
          {tasks && tasks.length > 0
            ? "No tasks match the current filters."
            : "No tasks yet — add the first one above."}
        </p>
      )}
    </section>
  );
}
