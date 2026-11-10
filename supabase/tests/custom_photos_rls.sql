-- Photos of custom exercises (migration 20261117000000_custom_exercise_photos.sql):
-- a member writes only in their own Storage folder and can attach only their
-- own photos. Run by CI on a fresh database; any failed check raises.
-- Everything happens in a transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'member-a@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'member-b@example.test');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', user_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'member'))::text, true);
$$;

set local role authenticated;

-- Member B has a photo of their own.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
insert into storage.objects (bucket_id, name)
values ('exercise-images', 'user/00000000-0000-0000-0000-0000000000d2/b.jpg');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
do $$
begin
  -- Their own folder: upload, attach, see, delete.
  insert into storage.objects (bucket_id, name)
  values ('exercise-images', 'user/00000000-0000-0000-0000-0000000000d1/a.jpg');
  insert into exercises (name, muscle_group, equipment, image_path)
  values ('My Row', 'upper-back', 'cable', 'user/00000000-0000-0000-0000-0000000000d1/a.jpg');

  delete from storage.objects
  where bucket_id = 'exercise-images' and name = 'user/00000000-0000-0000-0000-0000000000d1/a.jpg';
  if not found then
    raise exception 'a member could not delete their own exercise photo';
  end if;

  -- Someone else's folder, the admins' folder, the bucket root: no.
  begin
    insert into storage.objects (bucket_id, name)
    values ('exercise-images', 'user/00000000-0000-0000-0000-0000000000d2/a.jpg');
    raise exception 'a member could upload into another member''s folder';
  exception when insufficient_privilege then null; -- expected
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('exercise-images', 'own/a.jpg');
    raise exception 'a member could upload a built-in photo';
  exception when insufficient_privilege then null; -- expected
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('exercise-images', 'a.jpg');
    raise exception 'a member could upload to the bucket root';
  exception when insufficient_privilege then null; -- expected
  end;

  delete from storage.objects
  where bucket_id = 'exercise-images' and name = 'user/00000000-0000-0000-0000-0000000000d2/b.jpg';
  if found then
    raise exception 'a member could delete another member''s photo';
  end if;

  -- A custom exercise can't show someone else's photo, a built-in's file,
  -- or an end photo.
  begin
    insert into exercises (name, muscle_group, equipment, image_path)
    values ('Borrowed', 'lats', 'cable', 'user/00000000-0000-0000-0000-0000000000d2/b.jpg');
    raise exception 'a custom exercise could use another member''s photo';
  exception when check_violation then null; -- expected
  end;
  begin
    insert into exercises (name, muscle_group, equipment, image_path)
    values ('Borrowed', 'chest', 'barbell', 'repdb-bench-press.webp');
    raise exception 'a custom exercise could use a built-in photo';
  exception when check_violation then null; -- expected
  end;
  begin
    insert into exercises (name, muscle_group, equipment, image_path_end)
    values ('Two photos', 'chest', 'barbell', 'user/00000000-0000-0000-0000-0000000000d1/end.jpg');
    raise exception 'a custom exercise could have an end photo';
  exception when check_violation then null; -- expected
  end;
end $$;

rollback;
