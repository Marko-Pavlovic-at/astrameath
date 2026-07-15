-- Stage 1.5 task 4: imported historical time gets its own source so the XP
-- trigger can skip it. Imported hours count toward totals and stats, but never
-- award XP — the level stays a record of time actually tracked inside Astrameath.
--
-- Kept in its own migration: Postgres forbids using a freshly-added enum value in
-- the same transaction that added it, and the next migration references 'import'.
alter type public.session_source add value if not exists 'import';
