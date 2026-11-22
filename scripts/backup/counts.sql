-- Row counts saved with every backup (counts.txt) and compared after a
-- restore (docs/BACKUP.md). One "label|count" line each, in a fixed order.
select 'auth.users', count(*) from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select 'admins', count(*) from auth.users where raw_app_meta_data ->> 'role' = 'admin'
union all select 'exercises built-in', count(*) from public.exercises where user_id is null
union all select 'exercises built-in visible', count(*) from public.exercises where user_id is null and not hidden
union all select 'exercises custom', count(*) from public.exercises where user_id is not null
union all select 'routine_folders', count(*) from public.routine_folders
union all select 'routines', count(*) from public.routines
union all select 'routine_exercises', count(*) from public.routine_exercises
union all select 'workouts', count(*) from public.workouts
union all select 'workout_exercises', count(*) from public.workout_exercises
union all select 'sets', count(*) from public.sets
union all select 'profiles', count(*) from public.profiles
union all select 'photos', count(*) from storage.objects where bucket_id = 'exercise-images'
-- New tables go last: restore.mjs compares line by line, so a backup made
-- before a table existed still checks every line it has.
union all select 'body_weights', count(*) from public.body_weights
union all select 'exercise_notes', count(*) from public.exercise_notes
union all select 'push_subscriptions', count(*) from public.push_subscriptions;
