-- Admins add and edit built-in exercises (user_id null) from the app, with
-- photos in Storage. Everyone else keeps the old rules: read built-ins,
-- write only their own custom exercises.
--
-- Make an account admin (then sign out and in, so the token carries it):
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--   where email = '...';
-- app_metadata, not user_metadata: users can write their own user_metadata.

create function is_admin() returns boolean
language sql stable
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin', false)
$$;

-- No delete policy: a built-in may be in someone's history. Admins hide it.
create policy "admins insert built-in exercises" on exercises
  for insert to authenticated with check (user_id is null and (select is_admin()));
create policy "admins update built-in exercises" on exercises
  for update to authenticated using (user_id is null and (select is_admin()))
  with check (user_id is null and (select is_admin()));

-- Duplicate names are checked by the admin form, not a unique index: on a
-- fresh database seed.sql passes through duplicate names while it replays
-- the RepDB switch, and an index would make it fail.

-- Photos of admin-made built-ins: own/<uuid>.jpg. Public read (the app shows
-- them to everyone); a file name is never reused, so it can be cached forever.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-images', 'exercise-images', true, 1048576, array['image/jpeg']);

create policy "admins upload exercise images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-images' and (select is_admin()));
-- Storage's remove() looks the object up first, so deleting also needs select.
create policy "admins see exercise image objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-images' and (select is_admin()));
create policy "admins delete exercise images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exercise-images' and (select is_admin()));
