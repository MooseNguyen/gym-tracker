-- Each account sees and changes only its own exercise notes, and only on
-- exercises it may use (migration 20261122000000_exercise_notes.sql). Run by
-- CI on a fresh database; any failed check raises. Everything happens in a
-- transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'b@example.test');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- A built-in exercise both accounts may use.
create function pg_temp.built_in() returns uuid language sql as $$
  select id from exercises where user_id is null and not hidden order by name limit 1;
$$;

set local role authenticated;

-- Account B: a custom exercise, and notes on it and on the built-in.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
insert into exercises (id, name, muscle_group, equipment)
values ('00000000-0000-0000-0000-00000000e0b1', 'B''s own press', 'mid-chest', 'machine');
insert into exercise_notes (exercise_id, note) values
  ('00000000-0000-0000-0000-00000000e0b1', 'seat on 4'),
  (pg_temp.built_in(), 'wide grip');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
do $$
begin
  if exists (select 1 from exercise_notes) then
    raise exception 'an account could read another account''s exercise notes';
  end if;

  update exercise_notes set note = 'changed' where user_id = '00000000-0000-0000-0000-0000000000e2';
  if found then
    raise exception 'an account could change another account''s exercise note';
  end if;

  delete from exercise_notes where user_id = '00000000-0000-0000-0000-0000000000e2';
  if found then
    raise exception 'an account could delete another account''s exercise note';
  end if;

  begin
    insert into exercise_notes (user_id, exercise_id, note)
    values ('00000000-0000-0000-0000-0000000000e2', pg_temp.built_in(), 'not mine');
    raise exception 'an account could write a note for someone else';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into exercise_notes (exercise_id, note)
    values ('00000000-0000-0000-0000-00000000e0b1', 'their exercise');
    raise exception 'an account could put a note on someone else''s custom exercise';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into exercise_notes (exercise_id, note) values (pg_temp.built_in(), '   ');
    raise exception 'a blank note was accepted';
  exception when check_violation then null; -- expected
  end;

  begin
    insert into exercise_notes (exercise_id, note) values (pg_temp.built_in(), repeat('x', 201));
    raise exception 'a note over 200 characters was accepted';
  exception when check_violation then null; -- expected
  end;

  -- Its own note on a built-in: insert, then the upsert the app sends replaces it.
  insert into exercise_notes (exercise_id, note) values (pg_temp.built_in(), repeat('x', 200));
  insert into exercise_notes (user_id, exercise_id, note)
  values ('00000000-0000-0000-0000-0000000000e1', pg_temp.built_in(), 'seat on 5')
  on conflict (user_id, exercise_id) do update
    set note = excluded.note, updated_at = now();
  if (select count(*) from exercise_notes) <> 1 or (select note from exercise_notes) <> 'seat on 5' then
    raise exception 'a second note on the same exercise did not replace the first';
  end if;

  delete from exercise_notes where exercise_id = pg_temp.built_in();
  if not found then
    raise exception 'an account could not delete its own exercise note';
  end if;
end $$;

-- Account B's notes are untouched.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
do $$
begin
  if (select count(*) from exercise_notes) <> 2
    or not exists (select 1 from exercise_notes where note = 'wide grip') then
    raise exception 'another account''s exercise notes were changed';
  end if;
end $$;

rollback;
