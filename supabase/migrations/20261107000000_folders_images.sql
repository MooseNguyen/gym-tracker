-- Routine folders + exercise images.
-- A new migration rather than an edit of the first one: that one may already
-- have run on the live database, and migrations that already ran are history.

-- ---------------------------------------------------------------------------
-- Folders
-- ---------------------------------------------------------------------------
create table routine_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create index routine_folders_user_id_idx on routine_folders (user_id);

alter table routine_folders enable row level security;

create policy "own routine folders" on routine_folders
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deleting a folder keeps its routines: they just become unfiled.
alter table routines
  add column folder_id uuid references routine_folders (id) on delete set null;
create index routines_folder_id_idx on routines (folder_id);

-- A routine may only be put in one of the caller's own folders.
-- (RLS on routine_folders hides other users' folders from this subquery.)
drop policy "own routines" on routines;
create policy "own routines" on routines
  for all to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (folder_id is null or exists (select 1 from routine_folders f where f.id = folder_id))
  );

-- save_routine now also stores folder_id. Same signature, so replace in place.
create or replace function save_routine(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  r_id uuid := nullif(p ->> 'id', '')::uuid;
  f_id uuid := nullif(p ->> 'folder_id', '')::uuid;
  ex jsonb;
  pos int := 0;
begin
  if r_id is null then
    insert into routines (name, notes, folder_id) values (p ->> 'name', p ->> 'notes', f_id)
    returning id into r_id;
  else
    update routines set name = p ->> 'name', notes = p ->> 'notes', folder_id = f_id
    where id = r_id;
    if not found then
      raise exception 'Routine % not found', r_id using errcode = 'P0002';
    end if;
    delete from routine_exercises where routine_id = r_id;
  end if;

  for ex in select * from jsonb_array_elements(coalesce(p -> 'exercises', '[]'::jsonb)) loop
    insert into routine_exercises (routine_id, exercise_id, position, target_sets, rest_seconds)
    values (
      r_id,
      (ex ->> 'exercise_id')::uuid,
      pos,
      coalesce((ex ->> 'target_sets')::int, 3),
      coalesce((ex ->> 'rest_seconds')::int, 90)
    );
    pos := pos + 1;
  end loop;

  return r_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exercise images: a file name under /exercises/ in the app's public folder.
-- Built-in exercises only; null = show a placeholder icon.
-- ---------------------------------------------------------------------------
alter table exercises add column image_path text;

-- Every built-in exercise gets "<slug of its name>.webp", matching the files
-- produced by scripts/fetch-exercise-images.mjs. If a file is missing, the UI
-- falls back to the placeholder icon (the <img> onError handler).
update exercises
set image_path = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '.webp'
where user_id is null;
