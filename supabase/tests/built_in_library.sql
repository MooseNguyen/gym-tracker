-- Sanity checks on a database built from scratch (all migrations, in order).
-- Run by CI after `supabase db start`; any failed check raises and fails the job.
do $$
declare
  built_ins int;
  visible int;
  without_photo int;
  without_steps int;
  duplicate_names int;
  plain_groups int;
  bad_muscles int;
  old_data int;
  bad_secondary int;
  with_secondary int;
  marked_added int;
begin
  -- 264 before RepDB + 310 added; 48 old ones RepDB doesn't cover are hidden.
  select count(*) into built_ins from exercises where user_id is null;
  select count(*) into visible from exercises where user_id is null and not hidden;
  if built_ins <> 574 or visible <> 526 then
    raise exception 'expected 574 built-ins (526 visible), found % (% visible)', built_ins, visible;
  end if;

  -- Every exercise a user can pick has a photo and how-to steps (this also
  -- covers the first built-ins, from 20261106000001_seed_built_ins.sql).
  select count(*) into without_photo
  from exercises where user_id is null and not hidden and image_path is null;
  select count(*) into without_steps
  from exercises where user_id is null and not hidden and coalesce(cardinality(instructions), 0) = 0;
  if without_photo <> 0 or without_steps <> 0 then
    raise exception '% visible built-ins without a photo, % without steps', without_photo, without_steps;
  end if;

  -- free-exercise-db is gone: no built-in keeps its photo or steps.
  select count(*) into old_data
  from exercises
  where user_id is null
    and (image_path is null or image_path not like 'repdb-%')
    and (image_path is not null or image_path_end is not null or instructions is not null);
  if old_data <> 0 then
    raise exception '% built-ins still carry free-exercise-db photos or steps', old_data;
  end if;

  select count(*) into duplicate_names
  from (select name from exercises where user_id is null and not hidden group by name having count(*) > 1) d;
  if duplicate_names <> 0 then
    raise exception '% names are used by more than one visible built-in', duplicate_names;
  end if;

  -- Chest, back and shoulders built-ins must use a sub-muscle, not the plain group.
  select count(*) into plain_groups
  from exercises
  where user_id is null and muscle_group in ('chest', 'back', 'shoulders');
  if plain_groups <> 0 then
    raise exception '% built-in exercises still use a plain chest/back/shoulders group', plain_groups;
  end if;

  -- Every value must be one the app knows (src/types/db.ts).
  select count(*) into bad_muscles
  from exercises
  where user_id is null
    and muscle_group not in (
      'upper-chest', 'mid-chest', 'lower-chest',
      'lats', 'upper-back', 'traps', 'lower-back',
      'front-delts', 'side-delts', 'rear-delts',
      'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'cardio'
    );
  if bad_muscles <> 0 then
    raise exception '% built-in exercises have an unknown muscle_group', bad_muscles;
  end if;

  -- Secondary muscles: specific app values only (no plain group, no cardio),
  -- and the RepDB fill reached the first built-ins too.
  select count(*) into bad_secondary
  from exercises, unnest(secondary_muscles) as m
  where user_id is null
    and m not in (
      'upper-chest', 'mid-chest', 'lower-chest',
      'lats', 'upper-back', 'traps', 'lower-back',
      'front-delts', 'side-delts', 'rear-delts',
      'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core'
    );
  if bad_secondary <> 0 then
    raise exception '% secondary muscles of built-ins are not app muscle values', bad_secondary;
  end if;
  select count(*) into with_secondary
  from exercises where user_id is null and not hidden and cardinality(secondary_muscles) > 0;
  if with_secondary <> 493 then
    raise exception 'expected 493 visible built-ins with secondary muscles, found %', with_secondary;
  end if;

  -- Built-ins from the migrations ship with the app: none counts as added in it.
  select count(*) into marked_added from exercises where user_id is null and added_in_app;
  if marked_added <> 0 then
    raise exception '% built-ins from the migrations are marked added_in_app', marked_added;
  end if;

  raise notice 'ok: % built-in exercises', built_ins;
end
$$;
