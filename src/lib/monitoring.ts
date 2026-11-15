import * as Sentry from '@sentry/react'
import { NetworkError } from './unwrap'

/**
 * Error reporting to Sentry. Off unless VITE_SENTRY_DSN is set (production
 * and preview on Vercel), so local dev, CI and forks send nothing. The DSN is
 * public by design, like the Supabase anon key: it can only send events.
 *
 * Sent: the error and its stack, the browser, the page path, recent requests'
 * URLs, and the account's UUID. Not sent: email, IP address, request bodies,
 * workout data or anything in localStorage.
 */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  Sentry.init({
    dsn,
    release: __BUILD_ID__,
    environment: __APP_ENV__,
    // v11 collects all of these by default. Request bodies are workouts, and
    // headers carry the session token: none of it is needed to fix a bug.
    dataCollection: {
      userInfo: false, // no IP address (infer_ip: never); the UUID is set by hand
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Errors only: no performance tracing, no session replay.
    beforeSend: (event, hint) => (isReportable(hint.originalException) ? event : null),
  })
}

/**
 * Not a bug: no signal, or a request this app cancelled or timed out. The
 * save retries these by itself, and every phone in a basement gym would
 * report them.
 */
export function isReportable(error: unknown): boolean {
  if (error instanceof NetworkError) return false
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    return false
  return true
}

/** For errors the app handles and shows itself (a failed query or save). */
export function reportError(error: unknown) {
  if (isReportable(error)) Sentry.captureException(error)
}

/** Only the UUID, never the email: enough to tell one person's 50 errors from 50 people's. */
export function setMonitoringUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null)
}

/**
 * For createRoot's onCaughtError / onUncaughtError / onRecoverableError.
 * Setting them replaces React's own console logging, so it logs too.
 */
export const reactErrorHandler = Sentry.reactErrorHandler((error, errorInfo) => {
  console.error(error, errorInfo.componentStack)
})
