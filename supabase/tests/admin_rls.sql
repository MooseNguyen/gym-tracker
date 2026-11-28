-- Who may write built-in exercises and their photos (migration
-- 20261113000000_admin_exercises.sql). Run by CI on a fresh database; any
-- failed check raises. Everything happens in a transaction that is rolled back.
begin;

-- Updates target a built-in that exists (by id), so a refused update is not
-- confused with one that matched nothing.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'member@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@example.test');

create function pg_temp.act_as(user_id uuid, role text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', user_id, 'role', 'authenticated',
    'app_metadata', json_build_object('role', role))::text, true);
$$;

set local role authenticated;

-- A regular member: own custom exercises yes, built-ins and photos no.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', 'member');
do $$
begin
  insert into exercises (name, muscle_group, equipment) values ('My Row', 'upper-back', 'cable');
  if not (select added_in_app from exercises where name = 'My Row') then
    raise exception 'a custom exercise was not marked added_in_app';
  end if;

  begin
    insert into exercises (user_id, name, muscle_group, equipment)
    values (null, 'Member Built-in', 'lats', 'machine');
    raise exception 'a member could insert a built-in exercise';
  exception when insufficient_privilege then null; -- expected
  end;

  update exercises set name = 'Hacked' where id = (select id from exercises where user_id is null and not hidden order by name limit 1);
  if found then
    raise exception 'a member could rename a built-in exercise';
  end if;

  begin
    insert into storage.objects (bucket_id, name) values ('exercise-images', 'own/member.jpg');
    raise exception 'a member could upload an exercise photo';
  exception when insufficient_privilege then null; -- expected
  end;
end $$;

-- An admin: may add and edit built-ins, never delete them.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2', 'admin');
do $$
begin
  insert into exercises (user_id, name, muscle_group, equipment, image_path, instructions)
  values (null, 'Iso-Lateral Pulldown', 'lats', 'machine', 'own/test.jpg', array['Pull.']);
  if not (select added_in_app from exercises where user_id is null and name = 'Iso-Lateral Pulldown') then
    raise exception 'a built-in added by an admin was not marked added_in_app';
  end if;

  update exercises set equipment = 'other' where id = (select id from exercises where user_id is null and not hidden order by name limit 1);
  if not found then
    raise exception 'an admin could not edit a built-in exercise';
  end if;

  delete from exercises where user_id is null and name = 'Iso-Lateral Pulldown';
  if found then
    raise exception 'an admin could delete a built-in exercise';
  end if;

  insert into storage.objects (bucket_id, name) values ('exercise-images', 'own/admin.jpg');
end $$;

rollback;
