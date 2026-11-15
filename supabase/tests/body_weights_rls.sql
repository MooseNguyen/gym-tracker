-- Each account sees and changes only its own weigh-ins (migration
-- 20261118000000_body_weights.sql). Run by CI on a fresh database; any failed
-- check raises. Everything happens in a transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'b@example.test');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Account B logs a weigh-in (user_id comes from the default).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
insert into body_weights (measured_on, weight_kg) values ('2026-11-01', 90);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
do $$
begin
  if exists (select 1 from body_weights) then
    raise exception 'an account could read another account''s body weight';
  end if;

  update body_weights set weight_kg = 50 where user_id = '00000000-0000-0000-0000-0000000000d2';
  if found then
    raise exception 'an account could change another account''s body weight';
  end if;

  delete from body_weights where user_id = '00000000-0000-0000-0000-0000000000d2';
  if found then
    raise exception 'an account could delete another account''s body weight';
  end if;

  begin
    insert into body_weights (user_id, measured_on, weight_kg)
    values ('00000000-0000-0000-0000-0000000000d2', '2026-11-02', 80);
    raise exception 'an account could log a weigh-in for someone else';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into body_weights (measured_on, weight_kg) values ('2026-11-01', 7.8);
    raise exception 'a weight below 20 kg was accepted';
  exception when check_violation then null; -- expected
  end;

  -- Its own day: insert, then the upsert the app sends replaces it.
  insert into body_weights (measured_on, weight_kg) values ('2026-11-01', 80);
  insert into body_weights (user_id, measured_on, weight_kg)
  values ('00000000-0000-0000-0000-0000000000d1', '2026-11-01', 79.5)
  on conflict (user_id, measured_on) do update
    set weight_kg = excluded.weight_kg, updated_at = now();
  if (select count(*) from body_weights) <> 1 or (select weight_kg from body_weights) <> 79.5 then
    raise exception 'a second weigh-in on the same day did not replace the first';
  end if;

  delete from body_weights where measured_on = '2026-11-01';
  if not found then
    raise exception 'an account could not delete its own weigh-in';
  end if;
end $$;

-- Account B's row is untouched.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
do $$
begin
  if (select weight_kg from body_weights) <> 90 then
    raise exception 'another account''s weigh-in was changed';
  end if;
end $$;

rollback;
