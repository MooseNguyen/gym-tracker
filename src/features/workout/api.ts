import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { PreviousSet } from '../../types/db'
import type { SaveWorkoutPayload } from './draft'

/** Last time's sets for each exercise, grouped by exercise id. */
export function usePreviousSets(exerciseIds: string[], excludeWorkoutId?: string) {
  // Sorted so adding exercises in a different order reuses the cache entry.
  const ids = [...new Set(exerciseIds)].sort()
  return useQuery({
    queryKey: ['previous-sets', ids, excludeWorkoutId ?? null],
    enabled: ids.length > 0,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.rpc('previous_sets', {
          p_exercise_ids: ids,
          p_exclude_workout: excludeWorkoutId ?? null,
        }),
      ) as PreviousSet[]
      const byExercise = new Map<string, PreviousSet[]>()
      for (const r of rows) {
        const list = byExercise.get(r.exercise_id) ?? []
        list.push(r)
        byExercise.set(r.exercise_id, list)
      }
      return byExercise
    },
  })
}

export function useSaveWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveWorkoutPayload) =>
      unwrap(await supabase.rpc('save_workout', { p: payload })) as string,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['previous-sets'] })
      qc.invalidateQueries({ queryKey: ['exercise-history'] })
    },
  })
}
