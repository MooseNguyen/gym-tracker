import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Workout } from '../../types/db'

const WORKOUT_SELECT = `
  id, routine_id, name, started_at, ended_at, notes,
  workout_exercises (
    id, exercise_id, position, notes,
    exercise:exercises (id, user_id, name, muscle_group, equipment, kind, image_path),
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
