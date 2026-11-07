import { supabase } from '../../lib/supabase'

/** Storage bucket for photos of built-ins an admin made in the app. */
export const EXERCISE_IMAGE_BUCKET = 'exercise-images'

/** Paths of uploaded photos start with this; the rest are files under /exercises/. */
export const UPLOADED_PREFIX = 'own/'

/**
 * URL of an exercise photo. RepDB photos ship with the app (public/exercises);
 * admin uploads live in Storage. getPublicUrl only builds the string, no request.
 */
export function exerciseImageUrl(path: string): string {
  if (path.startsWith(UPLOADED_PREFIX))
    return supabase.storage.from(EXERCISE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  return `/exercises/${path}`
}
