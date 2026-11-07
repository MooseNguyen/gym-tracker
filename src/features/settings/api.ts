import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import type { Unit } from '../../shared/units'
import { useAuth } from '../auth/AuthProvider'

interface Profile {
  unit: Unit
}

const DEFAULTS: Profile = { unit: 'kg' }
const profileKey = ['profile'] as const

/**
 * The account's settings. No row yet means defaults. Kept in the saved query
 * cache like everything else, so the right unit is there on a cold start.
 */
export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: async () =>
      (unwrap(await supabase.from('profiles').select('unit').maybeSingle()) as Profile | null) ??
      DEFAULTS,
  })
}

/**
 * The weight unit to show. kg while loading or if the settings can't be
 * read: the numbers stay right either way (they are converted from kg), so
 * logging never waits on this.
 */
export function useUnit(): Unit {
  return useProfile().data?.unit ?? DEFAULTS.unit
}

export function useSetUnit() {
  const qc = useQueryClient()
  const userId = useAuth().session?.user.id
  return useMutation({
    mutationFn: async (unit: Unit) => {
      unwrap(
        await supabase
          .from('profiles')
          .upsert({ user_id: userId, unit, updated_at: new Date().toISOString() }),
      )
    },
    // The toggle flips at once; a failed save puts it back (onError).
    onMutate: async (unit) => {
      await qc.cancelQueries({ queryKey: profileKey })
      const before = qc.getQueryData<Profile>(profileKey)
      qc.setQueryData<Profile>(profileKey, { ...(before ?? DEFAULTS), unit })
      return { before }
    },
    onError: (_error, _unit, context) => qc.setQueryData(profileKey, context?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: profileKey }),
  })
}
