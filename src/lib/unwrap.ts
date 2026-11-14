/**
 * The request never got an answer: no signal, a dropped connection, or a
 * timeout. supabase-js reports these with status 0, and never retries a POST.
 * Worth retrying only where sending the same request twice is safe.
 */
export class NetworkError extends Error {
  name = 'NetworkError'
}

interface SupabaseResponse<T> {
  data: T
  error: { message: string } | null
  status?: number
}

/** Unwraps a Supabase response so callers (and TanStack Query) see a thrown Error. */
export function unwrap<T>(res: SupabaseResponse<T>): T {
  if (res.error) {
    throw res.status === 0 ? new NetworkError(res.error.message) : new Error(res.error.message)
  }
  return res.data
}
