import { supabase } from '../../lib/supabase'

/** Storage bucket for photos uploaded in the app. */
export const EXERCISE_IMAGE_BUCKET = 'exercise-images'

/** Admins' photos of built-ins: own/<uuid>.jpg. */
export const BUILT_IN_UPLOAD_PREFIX = 'own/'

/** A member's photos of their custom exercises: user/<their id>/<uuid>.jpg. */
export const customUploadPrefix = (userId: string) => `user/${userId}/`

/** Uploaded to Storage in the app, as opposed to a RepDB file under /exercises/. */
export function isUploaded(path: string): boolean {
  return path.startsWith(BUILT_IN_UPLOAD_PREFIX) || path.startsWith('user/')
}

/**
 * URL of an exercise photo. RepDB photos ship with the app (public/exercises);
 * uploads live in Storage. getPublicUrl only builds the string, no request.
 */
export function exerciseImageUrl(path: string): string {
  if (isUploaded(path))
    return supabase.storage.from(EXERCISE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  return `/exercises/${path}`
}
