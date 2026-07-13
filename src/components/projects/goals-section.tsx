"use client";

import { useState } from "react";
import { parseDateStr, todayStr } from "@/lib/dates";
import {
  useCreateGoal,
  useCreateMilestone,
  useDeleteGoal,
  useDeleteMilestone,
  useGoals,
  useSetGoalCompleted,
  useSetMilestoneCompleted,
  type Goal,
} from "@/lib/queries/goals";

function DeadlineBadge({ deadline, done }: { deadline: string; done: boolean }) {
  const overdue = !done && deadline < todayStr();
  return (
    <span className={overdue ? "text-danger" : "text-muted"}>
      ⚑{" "}
      {parseDateStr(deadline).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}
    </span>
  );
}

export default function GoalsSection({ projectId }: { projectId: string }) {
  const { data: goals } = useGoals(projectId);
  const createGoal = useCreateGoal(projectId);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createGoal.mutate({ title: title.trim(), deadline: deadline || null });
    setTitle("");
    setDeadline("");
    setAdding(false);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Goals{" "}
          <span className="normal-case tracking-normal">
            · +50 XP, milestones +25
          </span>
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex min-h-11 items-center rounded border border-edge px-3 text-xs text-muted hover:text-fg sm:min-h-0 sm:px-2 sm:py-1"
        >
          {adding ? "Cancel" : "+ Goal"}
        </button>
      </div>

      {adding && (
        <form onSubmit={addGoal} className="mt-2 flex flex-wrap gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal…"
            className="min-w-40 flex-1 rounded border border-edge bg-panel-2 px-3 py-1.5 text-fg outline-none focus:border-accent"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
            aria-label="Deadline (optional)"
          />
          <button
            type="submit"
            className="rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          >
            Add
          </button>
        </form>
      )}

      {goals && goals.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} projectId={projectId} />
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="mt-2 text-xs text-muted">
            No goals yet — define what this area is working toward.
          </p>
        )
      )}
    </div>
  );
}

function GoalRow({ goal, projectId }: { goal: Goal; projectId: string }) {
  const setGoalCompleted = useSetGoalCompleted(projectId);
  const deleteGoal = useDeleteGoal(projectId);
  const createMilestone = useCreateMilestone(projectId);
  const setMilestoneCompleted = useSetMilestoneCompleted(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);

  const [expanded, setExpanded] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDeadline, setMsDeadline] = useState("");

  const done = goal.completed_at !== null;
  const doneCount = goal.milestones.filter((m) => m.completed_at).length;

  function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!msTitle.trim()) return;
    createMilestone.mutate({
      goalId: goal.id,
      title: msTitle.trim(),
      deadline: msDeadline || null,
    });
    setMsTitle("");
    setMsDeadline("");
  }

  return (
    <li className="rounded-lg border border-edge bg-panel">
      <div className="flex items-center gap-1 p-3 sm:gap-3">
        <label className="-m-1 flex shrink-0 cursor-pointer items-center p-2.5 sm:p-1.5">
          <input
            type="checkbox"
            checked={done}
            onChange={() =>
              setGoalCompleted.mutate({ id: goal.id, completed: !done })
            }
            className="size-5 accent-[#c9a86a] sm:size-4"
            aria-label={done ? "Mark goal not completed" : "Mark goal completed"}
          />
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <span className={done ? "text-muted line-through" : ""}>
            <span
              aria-hidden
              className="mr-1.5 inline-block text-xs text-muted"
            >
              {expanded ? "▾" : "▸"}
            </span>
            {goal.title}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 pl-4 text-xs text-muted">
            {goal.deadline && (
              <DeadlineBadge deadline={goal.deadline} done={done} />
            )}
            <span className={goal.milestones.length === 0 ? "text-accent/80" : ""}>
              {goal.milestones.length > 0
                ? `${doneCount}/${goal.milestones.length} milestones`
                : "+ add milestones"}
            </span>
          </span>
        </button>
        <button
          onClick={() => {
            if (
              confirm(`Delete goal "${goal.title}" and its milestones?`)
            )
              deleteGoal.mutate(goal.id);
          }}
          className="-m-1 flex size-10 shrink-0 items-center justify-center text-sm text-danger/60 hover:text-danger sm:size-6"
          aria-label="Delete goal"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-edge p-3">
          {goal.milestones.map((m) => {
            const msDone = m.completed_at !== null;
            return (
              <div key={m.id} className="flex items-center gap-1 sm:gap-3">
                <label className="-m-1 flex shrink-0 cursor-pointer items-center p-2.5 sm:p-1.5">
                  <input
                    type="checkbox"
                    checked={msDone}
                    onChange={() =>
                      setMilestoneCompleted.mutate({
                        id: m.id,
                        completed: !msDone,
                      })
                    }
                    className="size-5 accent-[#c9a86a] sm:size-3.5"
                    aria-label={
                      msDone ? "Mark milestone not done" : "Mark milestone done"
                    }
                  />
                </label>
                <span
                  className={`min-w-0 flex-1 text-sm ${msDone ? "text-muted line-through" : ""}`}
                >
                  {m.title}
                  {m.deadline && (
                    <span className="ml-2 text-xs">
                      <DeadlineBadge deadline={m.deadline} done={msDone} />
                    </span>
                  )}
                </span>
                <button
                  onClick={() => deleteMilestone.mutate(m.id)}
                  className="-m-1 flex size-10 shrink-0 items-center justify-center text-xs text-danger/60 hover:text-danger sm:size-6"
                  aria-label="Delete milestone"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <form onSubmit={addMilestone} className="flex flex-wrap gap-2 pt-1">
            <input
              autoFocus={goal.milestones.length === 0}
              value={msTitle}
              onChange={(e) => setMsTitle(e.target.value)}
              placeholder="Milestone…"
              className="min-w-32 flex-1 rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
            />
            <input
              type="date"
              value={msDeadline}
              onChange={(e) => setMsDeadline(e.target.value)}
              className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-fg outline-none focus:border-accent"
              aria-label="Milestone deadline (optional)"
            />
            <button
              type="submit"
              className="rounded border border-edge px-3 py-1.5 text-sm text-muted hover:text-fg"
            >
              + Add
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
