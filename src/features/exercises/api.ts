import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { EXERCISE_IMAGE_BUCKET, isUploaded, UPLOADED_PREFIX } from '../../shared/ui/exerciseImage'
import type { Exercise, ExerciseKind } from '../../types/db'

const ADMIN_ONLY = 'Only admins can change built-in exercises.'

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
 * Built-ins an admin has hidden (or retired by a migration), for the admin's
 * "Show hidden" list. A separate query: the main list, which every picker
 * reads, stays visible-only. Loaded only while that list is open.
 */
export function useHiddenExercises(enabled: boolean) {
  return useQuery({
    queryKey: ['exercises', 'hidden'],
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('exercises')
          .select(`${EXERCISE_COLUMNS}, hidden`)
          .is('user_id', null)
          .eq('hidden', true)
          .order('name'),
      ) as Exercise[],
  })
}

/** Hides or unhides a built-in (admins only; RLS rejects anyone else). */
export function useSetExerciseHidden() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const res = await supabase.from('exercises').update({ hidden }).eq('id', id).select('id')
      if (res.error?.code === '42501') throw new Error(ADMIN_ONLY)
      // RLS hides a refused update instead of failing it: no row back.
      if ((unwrap(res) ?? []).length !== 1) throw new Error(ADMIN_ONLY)
    },
    // Prefix match: refreshes both the main list and the hidden one.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
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

/**
 * Photo changes from the admin form. undefined = keep the current photo; a
 * Blob = replace it (already resized); null = remove (end photo only).
 */
export interface PhotoChanges {
  start?: Blob
  end?: Blob | null
}

interface PhotoPaths {
  image_path: string | null
  image_path_end: string | null
}

export interface SaveCustom {
  /** Missing = create a new custom exercise. */
  id?: string
  /** On an edit, kind is left as it is: past sets were logged for it. */
  fields: NewExercise
}

/**
 * Creates or updates one of the member's own custom exercises (RLS limits a
 * member to their own rows). Custom exercises have no photo.
 */
export function useSaveCustomExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fields }: SaveCustom) => {
      const { kind, ...editable } = fields
      const res = id
        ? await supabase.from('exercises').update(editable).eq('id', id).select(EXERCISE_COLUMNS)
        : await supabase
            .from('exercises')
            .insert({ ...editable, kind })
            .select(EXERCISE_COLUMNS)
      const saved = unwrap(res) as Exercise[]
      // RLS hides a row that isn't the member's (or is gone): no row back.
      if (saved.length !== 1) throw new Error('This exercise no longer exists.')
      return saved[0]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] })
      // Routines and history show the exercise name too.
      qc.invalidateQueries({ queryKey: ['routines'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
    },
  })
}

/** Fields of a built-in exercise an admin edits in the app. */
export interface BuiltInFields extends NewExercise {
  instructions: string[]
  hidden: boolean
  secondary_muscles: string[]
}

export interface SaveBuiltIn {
  /** Missing = create a new built-in. */
  id?: string
  fields: BuiltInFields
  photos: PhotoChanges
  /** The photo paths the exercise has now (edit only), to clean up replaced uploads. */
  current?: PhotoPaths
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
  const own = paths.filter((p): p is string => !!p && isUploaded(p))
  if (own.length > 0) await supabase.storage.from(EXERCISE_IMAGE_BUCKET).remove(own)
}

/**
 * Uploads the new photos first and saves the row with their paths. If the row
 * then fails to save, the new uploads are removed again; on success, the
 * photos they replaced are.
 */
async function saveWithPhotos(
  photos: PhotoChanges,
  current: PhotoPaths | undefined,
  saveRow: (paths: Partial<PhotoPaths>) => Promise<Exercise>,
): Promise<Exercise> {
  const uploaded: string[] = []
  // undefined = keep, null = remove, a Blob = upload and use.
  const upload = async (blob: Blob | null | undefined) => {
    if (!blob) return blob
    const path = await uploadPhoto(blob)
    uploaded.push(path)
    return path
  }
  try {
    const start = await upload(photos.start)
    const end = await upload(photos.end)
    const saved = await saveRow({
      ...(start !== undefined && { image_path: start }),
      ...(end !== undefined && { image_path_end: end }),
    })
    await removeUploads([
      start !== undefined ? current?.image_path : null,
      end !== undefined ? current?.image_path_end : null,
    ])
    return saved
  } catch (e) {
    await removeUploads(uploaded)
    throw e
  }
}

/** Creates or updates a built-in exercise (admins only; RLS rejects anyone else). */
export function useSaveBuiltInExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields, photos, current }: SaveBuiltIn) =>
      saveWithPhotos(photos, current, async (paths) => {
        const row = { ...fields, ...paths }
        const res = id
          ? await supabase.from('exercises').update(row).eq('id', id).select(EXERCISE_COLUMNS)
          : await supabase
              .from('exercises')
              // Explicit null: the column defaults to the caller's id (a custom exercise).
              .insert({ ...row, user_id: null })
              .select(EXERCISE_COLUMNS)
        if (res.error?.code === '42501') throw new Error(ADMIN_ONLY)
        const saved = unwrap(res) as Exercise[]
        // RLS hides a refused update instead of failing it: no row back.
        if (saved.length !== 1) throw new Error(ADMIN_ONLY)
        return saved[0]
      }),
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
