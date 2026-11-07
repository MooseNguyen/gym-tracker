import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Exercise, ExerciseKind } from '../../types/db'

const EXERCISE_COLUMNS =
  'id, user_id, name, muscle_group, equipment, kind, image_path, image_path_end'

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('exercises')
          .select(EXERCISE_COLUMNS)
          // Retired built-ins stay in the table for history and routines,
          // but are no longer offered.
          .eq('hidden', false)
          .order('name'),
      ) as Exercise[],
    // The library barely changes; avoid refetching it on every picker open.
    staleTime: 10 * 60_000,
  })
}

/**
 * Step-by-step instructions, fetched only when the "How to" sheet opens.
 * Deliberately not part of EXERCISE_COLUMNS: lists, routines and history embed
 * exercises many times, and ~1 kB of text each would ride along for nothing.
 * The text never changes at runtime, so it is cached for the whole session.
 */
export function useExerciseInstructions(exerciseId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['exercise-instructions', exerciseId],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const row = unwrap(
        await supabase.from('exercises').select('instructions').eq('id', exerciseId).single(),
      ) as { instructions: string[] | null }
      return row.instructions ?? []
    },
  })
}

export interface NewExercise {
  name: string
  muscle_group: string
  equipment: string
  kind: ExerciseKind
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewExercise) =>
      unwrap(
        await supabase.from('exercises').insert(input).select(EXERCISE_COLUMNS).single(),
      ) as Exercise,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      // 23503 = foreign key violation: the exercise is used in a workout or routine.
      if (error?.code === '23503')
        throw new Error('This exercise is used in a routine or workout history.')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}
