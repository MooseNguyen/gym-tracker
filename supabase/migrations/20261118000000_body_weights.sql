-- Body weight log: one weigh-in per account per day.
--
-- Stored in kg like sets.weight_kg; the app converts to the account's unit
-- at the edges, so switching kg/lb never rewrites the log. The day is the
-- phone's local date ("weighed this morning"), not a timestamp: a second
-- entry for the same day replaces the first (upsert on the primary key).
create table body_weights (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  measured_on date not null,
  -- Wide enough for any adult; catches a typo like 7.8 for 78.
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  updated_at timestamptz not null default now(),
  primary key (user_id, measured_on)
);

alter table body_weights enable row level security;

-- (select auth.uid()): evaluated once per statement, see the init migration.
create policy "read own body weights" on body_weights
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own body weights" on body_weights
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own body weights" on body_weights
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "delete own body weights" on body_weights
  for delete to authenticated using (user_id = (select auth.uid()));
