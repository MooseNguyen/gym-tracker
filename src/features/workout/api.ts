import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NetworkError, supabase, unwrap } from '../../lib/supabase'
import type { PreviousSet } from '../../types/db'
import type { SaveWorkoutPayload } from './draft'

function groupByExercise(rows: PreviousSet[]) {
  const byExercise = new Map<string, PreviousSet[]>()
  for (const r of rows) {
    const list = byExercise.get(r.exercise_id) ?? []
    list.push(r)
    byExercise.set(r.exercise_id, list)
  }
  return byExercise
}

/** Last time's sets for each exercise, grouped by exercise id. */
export function usePreviousSets(exerciseIds: string[], excludeWorkoutId?: string) {
  // Sorted so adding exercises in a different order reuses the cache entry.
  const ids = [...new Set(exerciseIds)].sort()
  return useQuery({
    queryKey: ['previous-sets', ids, excludeWorkoutId ?? null],
    enabled: ids.length > 0,
    // The cache keeps the plain rows and the Map is built on read: the cache
    // is saved to localStorage as JSON, where a Map would come back as {}.
    queryFn: async () =>
      unwrap(
        await supabase.rpc('previous_sets', {
          p_exercise_ids: ids,
          // Left out (not null) when there is none: the function defaults it.
          p_exclude_workout: excludeWorkoutId,
        }),
      ) as PreviousSet[],
    select: groupByExercise,
  })
}

/** A hung request on a weak gym signal fails after this, and is sent again. */
const SAVE_TIMEOUT_MS = 15_000

/**
 * Keeps trying through a weak or lost signal while the page is open: offline,
 * TanStack pauses it (networkMode 'online') and resumes when the phone is
 * back online. Safe because the workout id is made on the phone and
 * save_workout replaces the whole workout: a request that did reach the
 * server, with only its answer lost, is not saved twice. Answers from the
 * server (validation, RLS) would fail the same way again, so no retry.
 */
export function useSaveWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveWorkoutPayload) =>
      unwrap(
        await supabase
          .rpc('save_workout', { p: payload })
          .abortSignal(AbortSignal.timeout(SAVE_TIMEOUT_MS)),
      ) as string,
    retry: (_failures, error) => error instanceof NetworkError,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['previous-sets'] })
      qc.invalidateQueries({ queryKey: ['exercise-history'] })
    },
  })
}
