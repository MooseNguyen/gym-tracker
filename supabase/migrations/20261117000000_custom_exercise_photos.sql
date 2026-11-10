-- Members add a photo to their own custom exercises. Same public bucket as the
-- admins' built-in photos: anyone with the link can see a photo, but the name
-- is a random uuid, so a link can't be guessed. Each member writes only under
-- user/<their id>/; admins keep own/ (20261113000000_admin_exercises.sql).

create policy "members upload own exercise photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
-- Storage's remove() looks the object up first, so deleting also needs select.
create policy "members see own exercise photo objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "members delete own exercise photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- A custom exercise shows only a photo from its owner's folder (not someone
-- else's upload, not a built-in's file), and only one: the end photo and the
-- How-to sheet are for built-ins.
alter table exercises
  add constraint exercises_custom_photo_is_own check (
    user_id is null
    or image_path is null
    or image_path like 'user/' || user_id::text || '/%'
  ),
  add constraint exercises_custom_one_photo check (user_id is null or image_path_end is null);
