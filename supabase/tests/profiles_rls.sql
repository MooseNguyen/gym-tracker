-- Each account sees and changes only its own settings (migration
-- 20261116000000_profiles.sql). Run by CI on a fresh database; any failed
-- check raises. Everything happens in a transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'kg@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'lb@example.test');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- The second account switches to lb (user_id comes from the default).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
insert into profiles (unit) values ('lb');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$
begin
  if exists (select 1 from profiles) then
    raise exception 'an account could read another account''s profile';
  end if;

  update profiles set unit = 'kg' where user_id = '00000000-0000-0000-0000-0000000000c2';
  if found then
    raise exception 'an account could change another account''s unit';
  end if;

  begin
    insert into profiles (user_id, unit) values ('00000000-0000-0000-0000-0000000000c2', 'kg');
    raise exception 'an account could write a profile for someone else';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into profiles (unit) values ('stone');
    raise exception 'an unknown unit was accepted';
  exception when check_violation then null; -- expected
  end;

  -- Its own row: insert, then the upsert the app sends.
  insert into profiles (unit) values ('lb');
  insert into profiles (user_id, unit) values ('00000000-0000-0000-0000-0000000000c1', 'kg')
  on conflict (user_id) do update set unit = excluded.unit, updated_at = now();
  if (select unit from profiles) <> 'kg' then
    raise exception 'an account could not change its own unit';
  end if;
end $$;

rollback;
