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
  /** File name under /exercises/ (built-in exercises only). */
  image_path: string | null
  /** Second photo, the end of the movement (RepDB built-ins); null = one photo. */
  image_path_end?: string | null
}

export interface RoutineFolder {
  id: string
  name: string
  created_at: string
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
  folder_id: string | null
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

/**
 * Finer targets inside some groups, stored in `exercises.muscle_group` in
 * place of the group itself (one primary target per exercise). The plain
 * group value stays valid and means "this group, no specific target" (e.g.
 * custom exercises created before the split).
 */
export const MUSCLE_SUBGROUPS: Partial<Record<(typeof MUSCLE_GROUPS)[number], readonly string[]>> =
  {
    chest: ['upper-chest', 'mid-chest', 'lower-chest'],
    back: ['lats', 'upper-back', 'traps', 'lower-back'],
    shoulders: ['front-delts', 'side-delts', 'rear-delts'],
  }

/** The top-level group of a stored muscle value ('lats' → 'back', 'biceps' → 'biceps'). */
export function muscleParent(muscle: string): string {
  for (const [group, subs] of Object.entries(MUSCLE_SUBGROUPS)) {
    if (subs?.includes(muscle)) return group
  }
  return muscle
}

/** Human label for a stored muscle value: 'upper-chest' → 'upper chest'. */
export const muscleLabel = (muscle: string) => muscle.replace(/-/g, ' ')

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const
