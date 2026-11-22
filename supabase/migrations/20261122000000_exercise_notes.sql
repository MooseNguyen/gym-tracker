-- Sticky note per exercise ("seat on 4, wide grip"): set-up details an
-- account wants every time the exercise comes up. One note per account per
-- exercise, built-in or custom. Not part of a workout: the per-workout notes
-- (workout_exercises.notes) stay with that one workout.
--
-- No empty notes: clearing the text deletes the row. 200 characters keeps it
-- to a couple of lines on the exercise card.
create table exercise_notes (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  exercise_id uuid not null references exercises (id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table exercise_notes enable row level security;

-- (select auth.uid()): evaluated once per statement, see the init migration.
-- can_use_exercise: only on a built-in or one of the caller's own exercises,
-- never on someone else's custom exercise.
create policy "read own exercise notes" on exercise_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own exercise notes" on exercise_notes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and can_use_exercise(exercise_id));
create policy "update own exercise notes" on exercise_notes
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and can_use_exercise(exercise_id));
create policy "delete own exercise notes" on exercise_notes
  for delete to authenticated using (user_id = (select auth.uid()));
