-- Astrameath initial schema
-- Design: docs/plans/astrameath-plan.md (V1 repo). All domain tables carry user_id
-- with RLS `user_id = auth.uid()`; levels/streaks/totals are always derived, never stored.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.stat_kind as enum
  ('strength', 'vitality', 'intelligence', 'discipline', 'creativity', 'social');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.xp_source as enum ('time', 'task_completion', 'milestone', 'goal', 'streak');
create type public.session_source as enum ('timer', 'manual');
create type public.unlock_kind as enum ('title', 'item', 'theme');
create type public.message_role as enum ('user', 'assistant');

-- ── Identity ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  active_title text,
  active_theme text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Projects & tasks ─────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  stat public.stat_kind not null,
  color text,
  icon text,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  deadline date,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  deadline date,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  notes text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  estimate_minutes integer check (estimate_minutes > 0),
  scheduled_date date,
  scheduled_time time,
  recurrence jsonb, -- non-null marks a recurring task template; occurrences live in task_completions
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_user_scheduled_idx on public.tasks (user_id, scheduled_date);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  completed_at timestamptz not null default now(),
  unique (task_id, date)
);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source public.session_source not null default 'timer',
  note text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
-- a running timer is a session with ended_at null; at most one per user
create unique index one_running_session_per_user
  on public.time_sessions (user_id) where (ended_at is null);
create index time_sessions_task_idx on public.time_sessions (task_id);
create index time_sessions_user_started_idx on public.time_sessions (user_id, started_at);

-- ── Gamification ─────────────────────────────────────────────────────────────
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stat public.stat_kind not null,
  amount integer not null,
  source public.xp_source not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index xp_events_user_stat_idx on public.xp_events (user_id, stat);

create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.unlock_kind not null,
  key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, kind, key)
);

-- ── AI companions ────────────────────────────────────────────────────────────
create table public.companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  avatar_url text,
  persona jsonb not null default '{}',
  model text not null default 'claude-haiku-4-5',
  created_at timestamptz not null default now()
);

create table public.companion_state (
  companion_id uuid primary key references public.companions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  relationship jsonb not null default '{}',
  mood text,
  mood_reason text,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.companion_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index companion_messages_idx on public.companion_messages (companion_id, created_at);

create table public.companion_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  companion_id uuid not null references public.companions (id) on delete cascade,
  content text not null,
  importance integer,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  companion_id uuid references public.companions (id) on delete set null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

-- ── Row-level security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'projects', 'goals', 'milestones', 'tasks', 'task_completions', 'time_sessions',
    'xp_events', 'unlocks', 'companions', 'companion_state', 'companion_messages',
    'companion_memories', 'ai_usage'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t
    );
  end loop;
end $$;

-- ── Storage: companion avatars ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
