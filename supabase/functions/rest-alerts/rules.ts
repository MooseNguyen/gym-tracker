// Pure rules of the rest-alerts function, kept apart from Deno.serve so
// `deno test` can check them without a database or a push service.

/**
 * An alert that should have gone out over a minute ago is dropped, not sent:
 * the row was saved late (no signal at the time) or the function was down.
 * "Rest over" five minutes late is noise.
 */
export const STALE_AFTER_MS = 60_000

export const isStale = (fireAt: string, now: number) => now - Date.parse(fireAt) > STALE_AFTER_MS

/**
 * The push service's answer for a subscription that no longer exists: the
 * app was removed, notifications were turned off in Settings, or the browser
 * rotated it. Its row is deleted so it is not tried again.
 */
export const isGone = (status: number) => status === 404 || status === 410

/** Compares the whole string every time, so the response time does not leak how much of a guess matched. */
export function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]
  return diff === 0
}

/** Shown by the service worker (public/push-sw.js). The same fixed text for everyone: no personal data. */
export const REST_OVER_PAYLOAD = {
  title: 'Rest over',
  body: 'Time for your next set.',
  url: '/workout',
}
