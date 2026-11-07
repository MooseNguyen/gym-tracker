-- The app no longer ships free-exercise-db photos or steps. Built-ins RepDB
-- doesn't cover were hidden by 20261111000000_repdb_library.sql; they keep
-- their name (history and routines still show it) but lose the old photo and
-- how-to steps, which now show as a placeholder / "no instructions".
update exercises
set image_path = null, image_path_end = null, instructions = null
where user_id is null
  and hidden
  and (image_path is null or image_path not like 'repdb-%');
