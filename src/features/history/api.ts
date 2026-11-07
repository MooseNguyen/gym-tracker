import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Workout } from '../../types/db'

const WORKOUT_SELECT = `
  id, routine_id, name, started_at, ended_at, notes,
  workout_exercises (
    id, exercise_id, position, notes,
    exercise:exercises (id, user_id, name, muscle_group, secondary_muscles, equipment, kind, image_path, image_path_end),
    sets (id, position, set_type, weight_kg, reps, duration_s, rpe)
  )`

const PAGE_SIZE = 20

export function useWorkouts() {
  return useInfiniteQuery({
    queryKey: ['workouts'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await supabase
          .from('workouts')
          .select(WORKOUT_SELECT)
          .order('started_at', { ascending: false })
          .order('position', { referencedTable: 'workout_exercises' })
          .order('position', { referencedTable: 'workout_exercises.sets' })
          .range(pageParam, pageParam + PAGE_SIZE - 1),
      ) as unknown as Workout[],
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
  })
}

/**
 * Full workouts that started in [from, to), for weekly muscle stats.
 * A week is a handful of workouts, so the full select stays small.
 */
export function useWorkoutsBetween(from: Date, to: Date) {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  return useQuery({
    queryKey: ['workouts', 'range', fromIso, toIso],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workouts')
          .select(WORKOUT_SELECT)
          .gte('started_at', fromIso)
          .lt('started_at', toIso)
          .order('started_at'),
      ) as unknown as Workout[],
  })
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: ['workouts', 'detail', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workouts')
          .select(WORKOUT_SELECT)
          .eq('id', id!)
          .order('position', { referencedTable: 'workout_exercises' })
          .order('position', { referencedTable: 'workout_exercises.sets' })
          .single(),
      ) as unknown as Workout,
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('workouts').delete().eq('id', id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['previous-sets'] })
      qc.invalidateQueries({ queryKey: ['exercise-history'] })
    },
  })
}

/**
 * Just the start times of workouts since `from`, for the home week strip.
 * Only two small columns, so it stays cheap even with many workouts.
 * The key starts with 'workouts', so saving or deleting a workout (which
 * invalidates ['workouts']) refreshes the strip too.
 */
export function useWorkoutDays(from: Date) {
  const fromIso = from.toISOString()
  return useQuery({
    queryKey: ['workouts', 'days', fromIso],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workouts')
          .select('id, started_at')
          .gte('started_at', fromIso)
          .order('started_at'),
      ) as { id: string; started_at: string }[],
  })
}

/** A set that was a personal record when it was lifted (see the workout_prs RPC). */
export interface WorkoutPr {
  workout_id: string
  set_id: string
  /** Heaviest weight so far for that exercise. */
  weight_pr: boolean
  /** Best estimated 1RM so far for that exercise. */
  e1rm_pr: boolean
}

/**
 * PR sets in the given workouts, computed by the database against all
 * earlier workouts. The key starts with 'workouts', so saving, editing or
 * deleting any workout (which invalidates ['workouts']) recomputes them.
 */
export function useWorkoutPrs(workoutIds: string[]) {
  const ids = [...workoutIds].sort()
  return useQuery({
    queryKey: ['workouts', 'prs', ids],
    enabled: ids.length > 0,
    queryFn: async () =>
      unwrap(await supabase.rpc('workout_prs', { p_workout_ids: ids })) as WorkoutPr[],
  })
}

/** PR sets per workout id, for the History cards. */
export function prCounts(prs: WorkoutPr[] | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of prs ?? []) counts.set(p.workout_id, (counts.get(p.workout_id) ?? 0) + 1)
  return counts
}
