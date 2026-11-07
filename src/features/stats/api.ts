import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { summarizeSession, type SessionSummary } from '../../shared/calc'
import type { Exercise, SetRow } from '../../types/db'

interface Row {
  workout: { id: string; started_at: string }
  sets: SetRow[]
}

export interface ExerciseHistory {
  exercise: Exercise
  sessions: (SessionSummary & { workoutId: string })[]
}

/** Every session that contains this exercise, oldest first, summarised for charts. */
export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: ['exercise-history', exerciseId],
    enabled: !!exerciseId,
    queryFn: async (): Promise<ExerciseHistory> => {
      const [exercise, rows] = await Promise.all([
        supabase
          .from('exercises')
          .select(
            'id, user_id, name, muscle_group, secondary_muscles, equipment, kind, image_path, image_path_end',
          )
          .eq('id', exerciseId!)
          .single(),
        // !inner turns the embed into an inner join; RLS still limits it to own workouts.
        supabase
          .from('workout_exercises')
          .select(
            'workout:workouts!inner (id, started_at), sets (id, position, set_type, weight_kg, reps, duration_s, rpe)',
          )
          .eq('exercise_id', exerciseId!),
      ])
      const data = unwrap(rows) as unknown as Row[]
      return {
        exercise: unwrap(exercise) as Exercise,
        sessions: data
          .map((r) => ({
            workoutId: r.workout.id,
            ...summarizeSession(r.workout.started_at, r.sets),
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }
    },
  })
}
