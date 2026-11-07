-- Personal records (PRs) set in the given workouts, for the History markers.
--
-- For each exercise logged as weight x reps, a workout sets at most two PRs:
--   weight: its heaviest working set (with reps), if heavier than every
--           working set of that exercise in earlier workouts;
--   e1rm:   its best estimated 1RM (Epley, as src/shared/calc), if better
--           than every earlier one.
-- Each is marked on the first set (by position) that reached it. The first
-- time an exercise is logged sets no PR: there is nothing to beat yet.
-- Computed on read, so editing an old workout moves later PRs with it.
-- security invoker: RLS limits it to the caller's own workouts.
create function workout_prs(p_workout_ids uuid[])
returns table (workout_id uuid, set_id uuid, weight_pr boolean, e1rm_pr boolean)
language sql
stable
security invoker
set search_path = public
as $$
  with lifted as (
    select w.id as workout_id, w.started_at, we.exercise_id, s.id as set_id,
           we.position as ex_position, s.position as set_position, s.weight_kg,
           case when s.reps = 1 then s.weight_kg
                else round(s.weight_kg * (1 + s.reps / 30.0), 1) end as e1rm
    from workouts w
    join workout_exercises we on we.workout_id = w.id
    join exercises e on e.id = we.exercise_id and e.kind = 'weight_reps'
    join sets s on s.workout_exercise_id = we.id
    where s.set_type <> 'warmup' and s.weight_kg > 0 and s.reps > 0
      and we.exercise_id in (
        select exercise_id from workout_exercises where workout_id = any (p_workout_ids)
      )
  ),
  -- Best of each exercise in each workout.
  per_workout as (
    select workout_id, started_at, exercise_id,
           max(weight_kg) as top_weight, max(e1rm) as top_e1rm
    from lifted
    group by workout_id, started_at, exercise_id
  ),
  records as (
    select p.workout_id, p.exercise_id, p.top_weight, p.top_e1rm,
           p.top_weight > before.weight as weight_pr,
           p.top_e1rm > before.e1rm as e1rm_pr
    from per_workout p
    cross join lateral (
      select max(l.weight_kg) as weight, max(l.e1rm) as e1rm
      from lifted l
      where l.exercise_id = p.exercise_id and l.started_at < p.started_at
    ) before
    where p.workout_id = any (p_workout_ids) and before.weight is not null
  ),
  weight_sets as (
    select distinct on (r.workout_id, r.exercise_id) l.set_id
    from records r
    join lifted l on l.workout_id = r.workout_id and l.exercise_id = r.exercise_id
                 and l.weight_kg = r.top_weight
    where r.weight_pr
    order by r.workout_id, r.exercise_id, l.ex_position, l.set_position
  ),
  e1rm_sets as (
    select distinct on (r.workout_id, r.exercise_id) l.set_id
    from records r
    join lifted l on l.workout_id = r.workout_id and l.exercise_id = r.exercise_id
                 and l.e1rm = r.top_e1rm
    where r.e1rm_pr
    order by r.workout_id, r.exercise_id, l.ex_position, l.set_position
  )
  select l.workout_id, l.set_id,
         l.set_id in (select set_id from weight_sets) as weight_pr,
         l.set_id in (select set_id from e1rm_sets) as e1rm_pr
  from lifted l
  where l.set_id in (select set_id from weight_sets union select set_id from e1rm_sets)
  order by l.workout_id, l.ex_position, l.set_position;
$$;
