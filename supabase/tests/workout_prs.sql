-- workout_prs() (migration 20261115000000_workout_prs.sql) on a small
-- history. Run by CI on a fresh database; any failed check raises.
-- Everything happens in a transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'lifter@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'stronger@example.test');

insert into exercises (id, user_id, name, muscle_group, equipment, kind) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'Test Squat', 'quads', 'barbell', 'weight_reps'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000b1', 'Test Dips', 'triceps', 'bodyweight', 'bodyweight_reps');

-- One workout per day: (workout, day, user, exercise, [(type, kg, reps)...]).
create function pg_temp.log(p_workout uuid, p_day int, p_user uuid, p_exercise uuid, p_sets text[])
returns void language plpgsql as $$
declare
  we uuid := gen_random_uuid();
  i int := 0;
  s text;
begin
  insert into workouts (id, user_id, name, started_at, ended_at)
  values (p_workout, p_user, 'W', timestamptz '2026-01-01' + p_day * interval '1 day',
          timestamptz '2026-01-01' + p_day * interval '1 day' + interval '1 hour')
  on conflict (id) do nothing;
  insert into workout_exercises (id, workout_id, exercise_id, position)
  values (we, p_workout, p_exercise, (select count(*) from workout_exercises where workout_id = p_workout));
  foreach s in array p_sets loop
    insert into sets (workout_exercise_id, position, set_type, weight_kg, reps)
    values (we, i, split_part(s, ' ', 1)::set_type, split_part(s, ' ', 2)::numeric,
            split_part(s, ' ', 3)::int);
    i := i + 1;
  end loop;
end $$;

-- Day 1, first time: nothing to beat.
select pg_temp.log('00000000-0000-0000-0000-0000000000d1', 1, '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-00000000e001', array['normal 100 5', 'normal 100 5']);
-- Day 2: a tie, and a heavy warm-up single (warm-ups never count).
select pg_temp.log('00000000-0000-0000-0000-0000000000d2', 2, '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-00000000e001', array['warmup 120 1', 'normal 100 5']);
-- Day 3: heavier (weight PR, e1RM 112.8 < 116.7) and a strong rep set (e1RM 126.7).
select pg_temp.log('00000000-0000-0000-0000-0000000000d3', 3, '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-00000000e001', array['normal 102.5 3', 'normal 95 10']);
-- Day 4: both records on one set, repeated: only the first set is marked.
-- Bodyweight dips never count (logged as reps only).
select pg_temp.log('00000000-0000-0000-0000-0000000000d4', 4, '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-00000000e001', array['normal 110 8', 'normal 110 8']);
select pg_temp.log('00000000-0000-0000-0000-0000000000d4', 4, '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-00000000e002', array['normal 20 12']);
-- Someone else lifts far more on day 0: not visible to the lifter, so no effect.
select pg_temp.log('00000000-0000-0000-0000-0000000000f1', 0, '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-00000000e001', array['normal 200 5']);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

do $$
declare
  got text;
  want text := 'd3: 102.5 x 3 weight | d3: 95 x 10 e1rm | d4: 110 x 8 weight+e1rm';
begin
  select string_agg(
           format('%s: %s x %s %s',
                  right(p.workout_id::text, 2),
                  trim(trailing '.' from trim(trailing '0' from s.weight_kg::text)),
                  s.reps,
                  concat_ws('+', case when p.weight_pr then 'weight' end,
                                 case when p.e1rm_pr then 'e1rm' end)),
           ' | ' order by p.workout_id, s.position)
  into got
  from workout_prs(array[
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4'
  ]::uuid[]) p
  join sets s on s.id = p.set_id;

  if got is distinct from want then
    raise exception E'workout_prs:\n  want %\n  got  %', want, got;
  end if;

  -- Computed on read: without day 3, day 4 is still a PR against day 1-2.
  delete from workouts where id = '00000000-0000-0000-0000-0000000000d3';
  if (select count(*) from workout_prs(array['00000000-0000-0000-0000-0000000000d4']::uuid[])) <> 1 then
    raise exception 'workout_prs: day 4 should keep its PR set after day 3 is deleted';
  end if;
end $$;

rollback;
