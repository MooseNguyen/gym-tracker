-- Per-account settings. For now only the weight unit shown in the app.
--
-- Weights are always STORED in kg (sets.weight_kg); the unit only changes
-- what is displayed and typed, and the app converts at the edges. So a
-- switch never rewrites history and kg/lb users share one schema.
--
-- No row = defaults (kg): the app upserts a row the first time a setting
-- changes, so existing accounts need no backfill.
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- (select auth.uid()): evaluated once per statement, see the init migration.
create policy "read own profile" on profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own profile" on profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own profile" on profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
