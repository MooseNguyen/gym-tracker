import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { EXERCISE_IMAGE_BUCKET, UPLOADED_PREFIX } from '../../shared/ui/exerciseImage'
import type { Exercise, ExerciseKind } from '../../types/db'

const EXERCISE_COLUMNS =
  'id, user_id, name, muscle_group, secondary_muscles, equipment, kind, image_path, image_path_end'

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

/** Fields of a built-in exercise an admin edits in the app. */
export interface BuiltInFields extends NewExercise {
  instructions: string[]
  hidden: boolean
  secondary_muscles: string[]
}

/**
 * Photo changes from the form. undefined = keep the current photo; a Blob =
 * replace it (already resized); null = remove (end photo only).
 */
export interface PhotoChanges {
  start?: Blob
  end?: Blob | null
}

export interface SaveBuiltIn {
  /** Missing = create a new built-in. */
  id?: string
  fields: BuiltInFields
  photos: PhotoChanges
  /** The photo paths the exercise has now (edit only), to clean up replaced uploads. */
  current?: { image_path: string | null; image_path_end: string | null }
}

async function uploadPhoto(blob: Blob): Promise<string> {
  // A new name for every upload: a URL never points at a different photo, so
  // browsers and the service worker can cache it forever.
  const path = `${UPLOADED_PREFIX}${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(EXERCISE_IMAGE_BUCKET)
    // The raw bytes, not the Blob: supabase-js wraps a Blob in a multipart
    // form, while an ArrayBuffer goes as a plain image/jpeg body.
    .upload(path, await blob.arrayBuffer(), {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    })
  if (error) throw new Error(`Photo upload failed: ${error.message}`)
  return path
}

/** Best effort: a leftover file only costs storage, so a failure is ignored. */
async function removeUploads(paths: (string | null | undefined)[]) {
  const own = paths.filter((p): p is string => !!p?.startsWith(UPLOADED_PREFIX))
  if (own.length > 0) await supabase.storage.from(EXERCISE_IMAGE_BUCKET).remove(own)
}

/**
 * Creates or updates a built-in exercise (admins only; RLS rejects anyone
 * else). Photos are uploaded first; if the row then fails to save, the new
 * uploads are removed again, and on success the replaced ones are.
 */
export function useSaveBuiltInExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fields, photos, current }: SaveBuiltIn) => {
      const uploaded: string[] = []
      try {
        const start = photos.start ? await uploadPhoto(photos.start) : undefined
        if (start) uploaded.push(start)
        const end = photos.end ? await uploadPhoto(photos.end) : photos.end
        if (end) uploaded.push(end)

        const row = {
          ...fields,
          ...(start !== undefined && { image_path: start }),
          ...(end !== undefined && { image_path_end: end }),
        }
        const res = id
          ? await supabase.from('exercises').update(row).eq('id', id).select(EXERCISE_COLUMNS)
          : await supabase
              .from('exercises')
              // Explicit null: the column defaults to the caller's id (a custom exercise).
              .insert({ ...row, user_id: null })
              .select(EXERCISE_COLUMNS)
        if (res.error?.code === '42501')
          throw new Error('Only admins can change built-in exercises.')
        const saved = unwrap(res) as Exercise[]
        // RLS hides a refused update instead of failing it: no row back.
        if (saved.length !== 1) throw new Error('Only admins can change built-in exercises.')

        await removeUploads([
          start !== undefined ? current?.image_path : null,
          end !== undefined ? current?.image_path_end : null,
        ])
        return saved[0]
      } catch (e) {
        await removeUploads(uploaded)
        throw e
      }
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['exercises'] })
      qc.invalidateQueries({ queryKey: ['exercise-instructions', saved.id] })
      // Routines and history show the exercise name and photo too.
      qc.invalidateQueries({ queryKey: ['routines'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
    },
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
