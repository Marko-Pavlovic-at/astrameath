-- Testing feedback 2026-07-05, item 7: casual projects (hobbies, gaming) can opt
-- out of the XP economy. `projects.no_xp = true` stops every award path under the
-- project — time, task completions, milestones, goals. Only future awards are
-- affected: existing XP stays, and the revoke triggers still work (they delete by
-- ref_id, a no-op when nothing was awarded).

alter table public.projects add column no_xp boolean not null default false;

-- ── Guard helpers ────────────────────────────────────────────────────────────
create function public.task_awards_xp(p_task_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not p.no_xp
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = p_task_id;
$$;

create function public.goal_awards_xp(p_goal_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not p.no_xp
  from public.goals g
  join public.projects p on p.id = g.project_id
  where g.id = p_goal_id;
$$;

create function public.project_awards_xp(p_project_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not no_xp from public.projects where id = p_project_id;
$$;

-- ── Re-create the five award functions with the guard ────────────────────────
create or replace function public.xp_session_award()
returns trigger
language plpgsql
set search_path = ''
as $$
declare mins int;
begin
  if new.ended_at is null then return new; end if;
  -- only the null → not-null transition awards (timer stop / manual insert)
  if tg_op = 'UPDATE' and old.ended_at is not null then return new; end if;
  if not public.task_awards_xp(new.task_id) then return new; end if;
  mins := floor(extract(epoch from (new.ended_at - new.started_at)) / 60);
  if mins >= 1 then
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, public.task_stat(new.task_id), mins, 'time', new.id);
  end if;
  return new;
end;
$$;

create or replace function public.xp_completion_award()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.task_awards_xp(new.task_id) then return new; end if;
  insert into public.xp_events (user_id, stat, amount, source, ref_id)
  values (new.user_id, public.task_stat(new.task_id), 10, 'task_completion', new.id);
  return new;
end;
$$;

create or replace function public.xp_task_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'done' and new.status = 'done' then
    if not public.project_awards_xp(new.project_id) then return new; end if;
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, (select stat from public.projects where id = new.project_id),
            10, 'task_completion', new.id);
  elsif old.status = 'done' and new.status <> 'done' then
    delete from public.xp_events where ref_id = new.id and source = 'task_completion';
  end if;
  return new;
end;
$$;

create or replace function public.xp_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    if not public.goal_awards_xp(new.goal_id) then return new; end if;
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, public.goal_stat(new.goal_id), 25, 'milestone', new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.xp_events where ref_id = new.id and source = 'milestone';
  end if;
  return new;
end;
$$;

create or replace function public.xp_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    if not public.project_awards_xp(new.project_id) then return new; end if;
    insert into public.xp_events (user_id, stat, amount, source, ref_id)
    values (new.user_id, (select stat from public.projects where id = new.project_id),
            50, 'goal', new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from public.xp_events where ref_id = new.id and source = 'goal';
  end if;
  return new;
end;
$$;
