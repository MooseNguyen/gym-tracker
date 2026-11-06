-- Sanity checks on a database built from scratch (all migrations + seed.sql).
-- Run by CI after `supabase db start`; any failed check raises and fails the job.
do $$
declare
  built_ins int;
  plain_groups int;
  bad_muscles int;
begin
  select count(*) into built_ins from exercises where user_id is null;
  if built_ins <> 264 then
    raise exception 'expected 264 built-in exercises, found %', built_ins;
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

  raise notice 'ok: % built-in exercises', built_ins;
end
$$;
