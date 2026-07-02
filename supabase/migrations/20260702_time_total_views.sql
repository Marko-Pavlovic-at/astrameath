-- Aggregated tracked time per task and per project.
-- security_invoker so the views run under the caller's RLS on time_sessions/tasks.
-- Running sessions (ended_at is null) are excluded — the client adds live elapsed.

create view public.task_time_totals
with (security_invoker = true) as
select
  s.task_id,
  s.user_id,
  sum(extract(epoch from (s.ended_at - s.started_at)))::bigint as total_seconds
from public.time_sessions s
where s.ended_at is not null
group by s.task_id, s.user_id;

create view public.project_time_totals
with (security_invoker = true) as
select
  t.project_id,
  s.user_id,
  sum(extract(epoch from (s.ended_at - s.started_at)))::bigint as total_seconds
from public.time_sessions s
join public.tasks t on t.id = s.task_id
where s.ended_at is not null
group by t.project_id, s.user_id;
