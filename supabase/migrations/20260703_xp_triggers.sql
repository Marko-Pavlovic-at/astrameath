-- Phase 4: XP ledger wiring.
-- Award amounts live here (single source of truth for writes); the level curve
-- lives in src/lib/xp.ts and is always derived at read time, never stored.
--
-- Rates: 1 XP / full minute tracked · 10 XP task completion (one-off done or
-- recurring per-day) · 25 XP milestone · 50 XP goal.
--
-- Every award carries ref_id = the row that caused it, so un-doing (uncheck,
-- un-complete, delete a session) revokes exactly that XP. Cascaded deletes fire
-- these row triggers too, so hard-deleting a task/project revokes its XP —
-- archiving a project keeps it.

-- ── Stat lookup helpers ──────────────────────────────────────────────────────
create function public.task_stat(p_task_id uuid)
returns public.stat_kind
language sql
stable
set search_path = ''
as $$
  select p.stat
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = p_task_id;
$$;

create function public.goal_stat(p_goal_id uuid)
returns public.stat_kind
language sql
stable
set search_path = ''
as $$
  select p.stat
  from public.goals g
  join public.projects p on p.id = g.project_id
  where g.id = p_goal_id;
$$;

-- ── Time sessions: 1 XP per full minute on finish ────────────────────────────
create function public.xp_session_award()
returns trigger
language plpgsql
set search_path = ''
as $$
declare mins int;
begin
  if new.ended_at is null then return new; end if;
  -- only the null → not-null transition awards (timer stop / manual insert)
  if tg_op = 'UPDATE' and old.ended_at is not null then return new; end if;
  mins := floor(extract(epoch from (new.ended_at - new.started_at)) / 60);
  if mins >= 1 then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, public.task_stat(new.task_id), mins, 'time', new.id);
  end if;
  return new;
end;
$$;

create trigger xp_on_session
  after insert or update of ended_at on public.time_sessions
  for each row execute function public.xp_session_award();

create function public.xp_session_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.xp_events where ref_id = old.id and source = 'time';
  return old;
end;
$$;

create trigger xp_on_session_delete
  after delete on public.time_sessions
  for each row execute function public.xp_session_revoke();

-- ── Recurring per-day completions: 10 XP ─────────────────────────────────────
create function public.xp_completion_award()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.xp_events (user_id, stat, amount, source, ref_id)
  values (new.user_id, public.task_stat(new.task_id), 10, 'task_completion', new.id);
  return new;
end;
$$;

create trigger xp_on_completion
  after insert on public.task_completions
  for each row execute function public.xp_completion_award();

create function public.xp_completion_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.xp_events where ref_id = old.id and source = 'task_completion';
  return old;
end;
$$;

create trigger xp_on_completion_delete
  after delete on public.task_completions
  for each row execute function public.xp_completion_revoke();

-- ── One-off tasks: 10 XP on done, revoked on un-done or delete ───────────────
create function public.xp_task_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'done' and new.status = 'done' then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, (select stat from public.projects where id = new.project_id),
            10, 'task_completion', new.id);
  elsif old.status = 'done' and new.status <> 'done' then
    delete from public.xp_events where ref_id = new.id and source = 'task_completion';
  end if;
  return new;
end;
$$;

create trigger xp_on_task_status
  after update of status on public.tasks
  for each row execute function public.xp_task_status();

create function public.xp_task_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.xp_events where ref_id = old.id and source = 'task_completion';
  return old;
end;
$$;

create trigger xp_on_task_delete
  after delete on public.tasks
  for each row execute function public.xp_task_revoke();

-- ── Milestones (25 XP) and goals (50 XP) on completion ───────────────────────
create function public.xp_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, public.goal_stat(new.goal_id), 25, 'milestone', new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.xp_events where ref_id = new.id and source = 'milestone';
  end if;
  return new;
end;
$$;

create trigger xp_on_milestone
  after update of completed_at on public.milestones
  for each row execute function public.xp_milestone();

create function public.xp_milestone_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.xp_events where ref_id = old.id and source = 'milestone';
  return old;
end;
$$;

create trigger xp_on_milestone_delete
  after delete on public.milestones
  for each row execute function public.xp_milestone_revoke();

create function public.xp_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, (select stat from public.projects where id = new.project_id),
            50, 'goal', new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.xp_events where ref_id = new.id and source = 'goal';
  end if;
  return new;
end;
$$;

create trigger xp_on_goal
  after update of completed_at on public.goals
  for each row execute function public.xp_goal();

create function public.xp_goal_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.xp_events where ref_id = old.id and source = 'goal';
  return old;
end;
$$;

create trigger xp_on_goal_delete
  after delete on public.goals
  for each row execute function public.xp_goal_revoke();

-- ── Aggregate view (same pattern as *_time_totals) ───────────────────────────
create view public.xp_totals
with (security_invoker = true) as
select user_id, stat, sum(amount)::bigint as total_xp
from public.xp_events
group by user_id, stat;

-- ── Backfill: award XP for everything tracked before these triggers ──────────
insert into public.xp_events (user_id, stat, amount, source, ref_id, created_at)
select s.user_id, public.task_stat(s.task_id),
       floor(extract(epoch from (s.ended_at - s.started_at)) / 60)::int,
       'time', s.id, s.ended_at
from public.time_sessions s
where s.ended_at is not null
  and floor(extract(epoch from (s.ended_at - s.started_at)) / 60) >= 1;

insert into public.xp_events (user_id, stat, amount, source, ref_id, created_at)
select c.user_id, public.task_stat(c.task_id), 10, 'task_completion', c.id, c.completed_at
from public.task_completions c;

insert into public.xp_events (user_id, stat, amount, source, ref_id, created_at)
select t.user_id, p.stat, 10, 'task_completion', t.id, coalesce(t.completed_at, now())
from public.tasks t
join public.projects p on p.id = t.project_id
where t.status = 'done';

insert into public.xp_events (user_id, stat, amount, source, ref_id, created_at)
select m.user_id, public.goal_stat(m.goal_id), 25, 'milestone', m.id, m.completed_at
from public.milestones m
where m.completed_at is not null;

insert into public.xp_events (user_id, stat, amount, source, ref_id, created_at)
select g.user_id, (select stat from public.projects where id = g.project_id), 50, 'goal', g.id, g.completed_at
from public.goals g
where g.completed_at is not null;
