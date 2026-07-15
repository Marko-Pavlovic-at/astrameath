-- Stage 1.5 task 5: optional personal data the companion can see — the "person
-- snapshot" alongside the app snapshot. All nullable, all user-editable, none
-- required. Weight is stored as a single current value (a weight *history* is a
-- separate, deferred feature); height in cm, weight in kg.
alter table public.profiles
  add column birthdate date,
  add column height_cm int,
  add column weight_kg numeric(5,1),
  add column bio text;
