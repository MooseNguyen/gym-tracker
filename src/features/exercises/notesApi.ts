import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

/** exercise id → note. A plain object, so the saved query cache can hold it. */
export type ExerciseNotes = Record<string, string>

const key = ['exercise-notes'] as const
const mutationKey = (exerciseId: string) => ['exercise-note', exerciseId] as const

/** Every note of the account in one request: a handful of short rows. */
export async function fetchExerciseNotes(): Promise<ExerciseNotes> {
  const rows = unwrap(await supabase.from('exercise_notes').select('exercise_id, note')) ?? []
  return Object.fromEntries(rows.map((r) => [r.exercise_id, r.note]))
}

/**
 * The note of one exercise, or undefined. A failed load shows no note (and
 * is reported by the query cache): the workout must never depend on it.
 */
export function useExerciseNote(exerciseId: string): string | undefined {
  return useQuery({ queryKey: key, queryFn: fetchExerciseNotes }).data?.[exerciseId]
}

/**
 * Saves (note) or deletes (null) the note. The screen shows the new note at
 * once and goes back to the old one if the server refuses it. Offline,
 * TanStack pauses the request and sends it when the phone is back online
 * (in memory only: closing the app first loses that one edit).
 */
export function useSaveExerciseNote(exerciseId: string) {
  const qc = useQueryClient()
  const userId = useAuth().session?.user.id
  return useMutation({
    mutationKey: mutationKey(exerciseId),
    mutationFn: async (note: string | null) => {
      if (note === null) {
        // Deleting a note that is already gone is fine: the result is the same.
        unwrap(await supabase.from('exercise_notes').delete().eq('exercise_id', exerciseId))
        return
      }
      const rows = unwrap(
        await supabase
          .from('exercise_notes')
          .upsert(
            {
              user_id: userId,
              exercise_id: exerciseId,
              note,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,exercise_id' },
          )
          .select('exercise_id'),
      )
      // RLS refuses by returning no row, not an error.
      if (rows?.length !== 1) throw new Error('The note was not saved.')
    },
    onMutate: async (note) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<ExerciseNotes>(key)
      qc.setQueryData<ExerciseNotes>(key, (notes = {}) => {
        const next = { ...notes }
        if (note === null) delete next[exerciseId]
        else next[exerciseId] = note
        return next
      })
      return { before }
    },
    onError: (_error, _note, context) => qc.setQueryData(key, context?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export type NoteSaveState =
  | { status: 'idle' }
  | { status: 'waiting' } // offline: sent when the signal is back
  | { status: 'saving' }
  | { status: 'failed'; note: string | null }

/** The latest save of this exercise's note, wherever it was started. */
export function useNoteSaveState(exerciseId: string): NoteSaveState {
  const states = useMutationState({
    filters: { mutationKey: mutationKey(exerciseId) },
    select: (m) => m.state,
  })
  const last = states.at(-1)
  if (!last) return { status: 'idle' }
  if (last.status === 'pending') return { status: last.isPaused ? 'waiting' : 'saving' }
  if (last.status === 'error')
    return { status: 'failed', note: typeof last.variables === 'string' ? last.variables : null }
  return { status: 'idle' }
}
