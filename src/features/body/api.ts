import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { BodyWeight } from './bodyWeight'

const key = ['body-weights'] as const

/** Every weigh-in, oldest first: one row a day, so years of them stay small. */
export async function fetchBodyWeights(): Promise<BodyWeight[]> {
  return (
    unwrap(
      await supabase
        .from('body_weights')
        .select('measured_on, weight_kg')
        .order('measured_on', { ascending: true }),
    ) ?? []
  )
}

export function useBodyWeights() {
  return useQuery({ queryKey: key, queryFn: fetchBodyWeights })
}

/** Logs a day's weigh-in; a second one for the same day replaces it. */
export function useSaveBodyWeight() {
  const qc = useQueryClient()
  const userId = useAuth().session?.user.id
  return useMutation({
    mutationFn: async (entry: BodyWeight) => {
      const rows = unwrap(
        await supabase
          .from('body_weights')
          .upsert(
            { user_id: userId, ...entry, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,measured_on' },
          )
          .select('measured_on'),
      )
      // RLS refuses by returning no row, not an error.
      if (rows?.length !== 1) throw new Error('The weigh-in was not saved.')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteBodyWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (measuredOn: string) => {
      const rows = unwrap(
        await supabase
          .from('body_weights')
          .delete()
          .eq('measured_on', measuredOn)
          .select('measured_on'),
      )
      if (rows?.length !== 1) throw new Error('This weigh-in no longer exists.')
    },
    // Also after a failure: a weigh-in deleted elsewhere disappears here too.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
