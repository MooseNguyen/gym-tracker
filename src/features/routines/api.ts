import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Routine } from '../../types/db'

const ROUTINE_SELECT = `
  id, name, notes, created_at,
  routine_exercises (
    id, exercise_id, position, target_sets, rest_seconds,
    exercise:exercises (id, user_id, name, muscle_group, equipment, kind)
  )`

export function useRoutines() {
  return useQuery({
    queryKey: ['routines'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('routines')
          .select(ROUTINE_SELECT)
          .order('created_at')
          .order('position', { referencedTable: 'routine_exercises' }),
      ) as unknown as Routine[],
  })
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: ['routines', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('routines')
          .select(ROUTINE_SELECT)
          .eq('id', id!)
          .order('position', { referencedTable: 'routine_exercises' })
          .single(),
      ) as unknown as Routine,
  })
}

export interface RoutineInput {
  id?: string
  name: string
  notes: string | null
  exercises: { exercise_id: string; target_sets: number; rest_seconds: number }[]
}

export function useSaveRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RoutineInput) =>
      unwrap(await supabase.rpc('save_routine', { p: input })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('routines').delete().eq('id', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}
