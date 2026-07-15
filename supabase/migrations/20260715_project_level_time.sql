-- Stage 1.5 task 4: time can be logged and edited at the PROJECT level, not only
-- through a task. A session now always has a project and OPTIONALLY a task.
--   * task_id becomes nullable; project_id is added (not null, backfilled).
--   * a before-trigger keeps project_id in sync with the task when task-attached,
--     so existing insert paths (timer start supplies only task_id) keep working.
--   * project_time_totals no longer joins through the task.
--   * the XP trigger reads stat/no_xp from the session's project, skips 'import'
--     rows, and recomputes when a finished session's times are edited.

-- ── Columns ──────────────────────────────────────────────────────────────────
alter table public.time_sessions
  add column project_id uuid references public.projects (id) on delete cascade;

update public.time_sessions s
  set project_id = t.project_id
  from public.tasks t
  where t.id = s.task_id;

alter table public.time_sessions alter column project_id set not null;
alter table public.time_sessions alter column task_id drop not null;
create index time_sessions_project_idx on public.time_sessions (project_id);

-- ── Keep project_id consistent with the task ─────────────────────────────────
-- A task-attached session always inherits its task's project; a task-less session
-- must be given one. Runs BEFORE the not-null check, so timer-start (task_id only)
-- keeps inserting without app changes.
create function public.time_session_set_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is not null then
    select project_id into new.project_id from public.tasks where id = new.task_id;
  end if;
  if new.project_id is null then
    raise exception 'time_sessions.project_id cannot be null';
  end if;
  return new;
end;
$$;

create trigger time_session_project_sync
  before insert or update of task_id, project_id on public.time_sessions
  for each row execute function public.time_session_set_project();

-- ── Rewire the time-total views off the task join ────────────────────────────
drop view if exists public.project_time_totals;
create view public.project_time_totals
with (security_invoker = true) as
select
  s.project_id,
  s.user_id,
  sum(extract(epoch from (s.ended_at - s.started_at)))::bigint as total_seconds
from public.time_sessions s
where s.ended_at is not null
group by s.project_id, s.user_id;

drop view if exists public.task_time_totals;
create view public.task_time_totals
with (security_invoker = true) as
select
  s.task_id,
  s.user_id,
  sum(extract(epoch from (s.ended_at - s.started_at)))::bigint as total_seconds
from public.time_sessions s
where s.ended_at is not null and s.task_id is not null
group by s.task_id, s.user_id;

-- ── XP: read the project from the session; skip imports; recompute on edit ───
create or replace function public.xp_session_award()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mins int;
  v_stat public.stat_kind;
  v_no_xp boolean;
begin
  -- Editing a finished session revokes the prior award before recomputing, so a
  -- corrected duration corrects the XP too.
  if tg_op = 'UPDATE' then
    delete from public.xp_events where ref_id = new.id and source = 'time';
  end if;
  if new.ended_at is null then return new; end if;
  if new.source = 'import' then return new; end if;  -- imported time never awards XP
  select p.stat, p.no_xp into v_stat, v_no_xp
    from public.projects p where p.id = new.project_id;
  if v_no_xp then return new; end if;
  mins := floor(extract(epoch from (new.ended_at - new.started_at)) / 60);
  if mins >= 1 then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, v_stat, mins, 'time', new.id);
  end if;
  return new;
end;
$$;

-- fires on started_at too now, so a duration edit updates XP
drop trigger xp_on_session on public.time_sessions;
create trigger xp_on_session
  after insert or update of started_at, ended_at on public.time_sessions
  for each row execute function public.xp_session_award();
