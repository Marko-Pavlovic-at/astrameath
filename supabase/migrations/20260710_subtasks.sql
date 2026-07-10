-- Subtasks: a checklist of steps under a single task. This is task
-- *decomposition* — a different axis from goals/milestones (project objectives).
-- Subtasks are never scheduled, never timed, and by decision award NO XP; the
-- parent task keeps its existing +10 on completion. The parent's progress bar
-- is derived (done / total) at read time — nothing about progress is stored.
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index subtasks_task_idx on public.subtasks (task_id);

alter table public.subtasks enable row level security;
create policy "own rows" on public.subtasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
