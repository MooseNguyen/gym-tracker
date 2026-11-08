-- Loads a backup into a FRESH project whose schema was created with
-- `supabase db push` (docs/BACKUP.md). Run by restore.mjs from inside the
-- backup folder, so \i finds the dumps.
-- One transaction: any error rolls everything back, nothing half-loaded.
\set ON_ERROR_STOP on
begin;

-- Never load into a project that already has accounts or workouts (for
-- example production): the ids would collide or, worse, mix two datasets.
do $$
begin
  if exists (select 1 from auth.users) or exists (select 1 from public.workouts) then
    raise exception 'Target project is not empty: restore only into a fresh project';
  end if;
end $$;

-- Foreign keys and triggers off while loading: the dump's table order does
-- not have to follow the references.
set local session_replication_role = replica;

-- `db push` ran the data migrations, which inserted the built-in exercises.
-- The backup's rows (same ids, hidden flags, admin-added photos) replace
-- them, so workouts keep pointing at the same exercises.
truncate public.exercises cascade;

\i auth-data.sql
\i public-data.sql

commit;
