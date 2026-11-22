// Pure decisions behind the rest-over notification, kept apart from the
// browser APIs so they can be unit tested.

export type PushSupport = 'unsupported' | 'install-first' | 'available'

/**
 * iPhone Safari only offers Web Push to an app added to the Home Screen
 * (iOS 16.4+); in a Safari tab the API is simply missing, which would look
 * like "unsupported". Say what to do instead.
 */
export function pushSupport(env: {
  hasKey: boolean
  hasPushApi: boolean
  isIos: boolean
  standalone: boolean
}): PushSupport {
  if (!env.hasKey) return 'unsupported'
  if (env.isIos && !env.standalone) return 'install-first'
  return env.hasPushApi ? 'available' : 'unsupported'
}

export type AlertWrite = { kind: 'save'; fireAt: string } | { kind: 'clear' } | null

/**
 * What the server's rest_alerts row needs when the draft's rest end changes
 * from `prev` to `next` (epoch ms). `prev` is undefined on the first look
 * after the app opens: a rest still running is saved again (harmless upsert),
 * and no rest means nothing to clear, so opening the app writes nothing.
 */
export function alertWrite(
  prev: number | null | undefined,
  next: number | null,
  now: number,
): AlertWrite {
  if (next === prev) return null
  if (next != null && next > now) return { kind: 'save', fireAt: new Date(next).toISOString() }
  // Skip / Close, or −15 past the end: the rest is over here already, so a
  // push a few seconds later would only repeat it.
  if (prev != null) return { kind: 'clear' }
  return null
}

/** The VAPID public key as the bytes PushManager.subscribe expects (it is base64url). */
export function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
