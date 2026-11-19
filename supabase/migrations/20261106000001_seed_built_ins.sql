-- The first built-in exercises (user_id null = visible to every user), right
-- after the schema, so every later migration that updates built-ins finds
-- them. This used to be supabase/seed.sql, which the CLI runs after ALL the
-- migrations; the seed then had to replay those updates on its own rows.
-- Runs as the database owner, so RLS does not apply here.
--
-- Only on a database without built-ins: on one set up the old way (init.sql,
-- then seed.sql) these rows already exist, renamed by later migrations, so a
-- name check could not tell them apart. Mark it applied there instead:
--   npx supabase migration repair --status applied 20261106000001
insert into exercises (user_id, name, muscle_group, equipment, kind)
select null::uuid, v.name, v.muscle_group, v.equipment, v.kind::exercise_kind
from (values
  -- Chest
  ('Bench Press', 'mid-chest', 'barbell', 'weight_reps'),
  ('Incline Bench Press', 'upper-chest', 'barbell', 'weight_reps'),
  ('Dumbbell Bench Press', 'mid-chest', 'dumbbell', 'weight_reps'),
  ('Incline Dumbbell Press', 'upper-chest', 'dumbbell', 'weight_reps'),
  ('Dumbbell Fly', 'mid-chest', 'dumbbell', 'weight_reps'),
  ('Cable Crossover', 'lower-chest', 'cable', 'weight_reps'),
  ('Machine Chest Press', 'mid-chest', 'machine', 'weight_reps'),
  ('Pec Deck', 'mid-chest', 'machine', 'weight_reps'),
  ('Push Up', 'mid-chest', 'bodyweight', 'bodyweight_reps'),
  ('Chest Dip', 'lower-chest', 'bodyweight', 'bodyweight_reps'),
  -- Back
  ('Deadlift', 'lower-back', 'barbell', 'weight_reps'),
  ('Barbell Row', 'upper-back', 'barbell', 'weight_reps'),
  ('Dumbbell Row', 'lats', 'dumbbell', 'weight_reps'),
  ('Pull Up', 'lats', 'bodyweight', 'bodyweight_reps'),
  ('Chin Up', 'lats', 'bodyweight', 'bodyweight_reps'),
  ('Lat Pulldown', 'lats', 'cable', 'weight_reps'),
  ('Seated Cable Row', 'upper-back', 'cable', 'weight_reps'),
  ('T-Bar Row', 'upper-back', 'barbell', 'weight_reps'),
  ('Machine Row', 'upper-back', 'machine', 'weight_reps'),
  ('Straight Arm Pulldown', 'lats', 'cable', 'weight_reps'),
  ('Back Extension', 'lower-back', 'bodyweight', 'bodyweight_reps'),
  -- Shoulders
  ('Overhead Press', 'front-delts', 'barbell', 'weight_reps'),
  ('Seated Dumbbell Press', 'front-delts', 'dumbbell', 'weight_reps'),
  ('Machine Shoulder Press', 'front-delts', 'machine', 'weight_reps'),
  ('Lateral Raise', 'side-delts', 'dumbbell', 'weight_reps'),
  ('Cable Lateral Raise', 'side-delts', 'cable', 'weight_reps'),
  ('Rear Delt Fly', 'rear-delts', 'dumbbell', 'weight_reps'),
  ('Face Pull', 'rear-delts', 'cable', 'weight_reps'),
  ('Front Raise', 'front-delts', 'dumbbell', 'weight_reps'),
  ('Barbell Shrug', 'traps', 'barbell', 'weight_reps'),
  -- Arms
  ('Barbell Curl', 'biceps', 'barbell', 'weight_reps'),
  ('Dumbbell Curl', 'biceps', 'dumbbell', 'weight_reps'),
  ('Hammer Curl', 'biceps', 'dumbbell', 'weight_reps'),
  ('Preacher Curl', 'biceps', 'machine', 'weight_reps'),
  ('Cable Curl', 'biceps', 'cable', 'weight_reps'),
  ('Incline Dumbbell Curl', 'biceps', 'dumbbell', 'weight_reps'),
  ('Triceps Pushdown', 'triceps', 'cable', 'weight_reps'),
  ('Overhead Cable Triceps Extension', 'triceps', 'cable', 'weight_reps'),
  ('Skull Crusher', 'triceps', 'barbell', 'weight_reps'),
  ('Close Grip Bench Press', 'triceps', 'barbell', 'weight_reps'),
  ('Triceps Dip', 'triceps', 'bodyweight', 'bodyweight_reps'),
  ('Wrist Curl', 'forearms', 'dumbbell', 'weight_reps'),
  -- Legs
  ('Back Squat', 'quads', 'barbell', 'weight_reps'),
  ('Front Squat', 'quads', 'barbell', 'weight_reps'),
  ('Leg Press', 'quads', 'machine', 'weight_reps'),
  ('Hack Squat', 'quads', 'machine', 'weight_reps'),
  ('Bulgarian Split Squat', 'quads', 'dumbbell', 'weight_reps'),
  ('Walking Lunge', 'quads', 'dumbbell', 'weight_reps'),
  ('Goblet Squat', 'quads', 'dumbbell', 'weight_reps'),
  ('Leg Extension', 'quads', 'machine', 'weight_reps'),
  ('Romanian Deadlift', 'hamstrings', 'barbell', 'weight_reps'),
  ('Lying Leg Curl', 'hamstrings', 'machine', 'weight_reps'),
  ('Seated Leg Curl', 'hamstrings', 'machine', 'weight_reps'),
  ('Hip Thrust', 'glutes', 'barbell', 'weight_reps'),
  ('Cable Kickback', 'glutes', 'cable', 'weight_reps'),
  ('Hip Abduction', 'glutes', 'machine', 'weight_reps'),
  ('Standing Calf Raise', 'calves', 'machine', 'weight_reps'),
  ('Seated Calf Raise', 'calves', 'machine', 'weight_reps'),
  -- Core
  ('Plank', 'core', 'bodyweight', 'duration'),
  ('Hanging Leg Raise', 'core', 'bodyweight', 'bodyweight_reps'),
  ('Cable Crunch', 'core', 'cable', 'weight_reps'),
  ('Ab Wheel Rollout', 'core', 'bodyweight', 'bodyweight_reps'),
  ('Russian Twist', 'core', 'bodyweight', 'bodyweight_reps'),
  -- Cardio
  ('Treadmill', 'cardio', 'machine', 'duration'),
  ('Stationary Bike', 'cardio', 'machine', 'duration'),
  ('Rowing Machine', 'cardio', 'machine', 'duration')
) as v (name, muscle_group, equipment, kind)
where not exists (select 1 from exercises where user_id is null);
