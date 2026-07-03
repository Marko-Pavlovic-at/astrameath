-- Recent-context FIFO for companions (last ~8 one-line "what just happened"
-- strings, written by the update_state tool each turn). Carried over from V1.
alter table public.companion_state
  add column recent_events jsonb not null default '[]';
