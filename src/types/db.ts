// Hand-written row types matching supabase/migrations.
// Once a Supabase project exists, these can be replaced by
// `npx supabase gen types typescript --linked > src/types/supabase.ts`.

export type ExerciseKind = 'weight_reps' | 'bodyweight_reps' | 'duration'
export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface Exercise {
  id: string
  user_id: string | null
  name: string
  muscle_group: string
  equipment: string
  kind: ExerciseKind
}

export interface RoutineExercise {
  id: string
  exercise_id: string
  position: number
  target_sets: number
  rest_seconds: number
  exercise: Exercise
}

export interface Routine {
  id: string
  name: string
  notes: string | null
  created_at: string
  routine_exercises: RoutineExercise[]
}

export interface SetRow {
  id: string
  position: number
  set_type: SetType
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  rpe: number | null
}

export interface WorkoutExerciseRow {
  id: string
  exercise_id: string
  position: number
  notes: string | null
  exercise: Exercise
  sets: SetRow[]
}

export interface Workout {
  id: string
  routine_id: string | null
  name: string
  started_at: string
  ended_at: string
  notes: string | null
  workout_exercises: WorkoutExerciseRow[]
}

export interface PreviousSet {
  exercise_id: string
  position: number
  set_type: SetType
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  rpe: number | null
}

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
] as const

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'] as const
