import { useSyncExternalStore } from 'react'
import { supabase, unwrap } from '../../lib/supabase'
import { base64UrlToBytes, pushSupport } from './restPushRules'

/**
 * "Rest over" push notifications on this device. The state lives in the
 * browser (permission + push subscription), not in React or the query cache:
 * it belongs to this phone, and the browser can change it behind the app's
 * back (Settings → Notifications).
 */
export type RestPushState = 'checking' | 'unsupported' | 'install-first' | 'denied' | 'off' | 'on'

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

let state: RestPushState = 'checking'
const listeners = new Set<() => void>()
function set(next: RestPushState) {
  state = next
  listeners.forEach((l) => l())
}

export function useRestPushState(): RestPushState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const isRestPushOn = () => state === 'on'

function support() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return pushSupport({
    hasKey: !!vapidKey,
    hasPushApi: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    // iPadOS reports itself as a Mac; the touch points give it away.
    isIos:
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    standalone: matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  })
}

/** Null when no service worker is installed (local dev, or the first visit). */
async function pushManager(): Promise<PushManager | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager ?? null
}

/** Reads this device's state; also re-sends a live subscription (see below). */
export async function refreshRestPush() {
  const s = support()
  if (s !== 'available') return set(s)
  if (Notification.permission === 'denied') return set('denied')
  const manager = await pushManager()
  if (!manager) return set('unsupported')
  const subscription = await manager.getSubscription()
  set(subscription && Notification.permission === 'granted' ? 'on' : 'off')
  // The server deletes a subscription the push service rejected, and this
  // also covers a row lost some other way: sending it again is a no-op when
  // it is there (insert … on conflict do nothing).
  if (subscription) await saveSubscription(subscription)
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.')
  }
  unwrap(
    await supabase
      .from('push_subscriptions')
      .upsert(
        { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'user_id,endpoint', ignoreDuplicates: true },
      ),
  )
}

/**
 * Must run straight from a tap: iOS only shows the permission prompt for a
 * user gesture, so requestPermission is the first await.
 */
export async function turnOnRestPush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return set(permission === 'denied' ? 'denied' : 'off')

  const manager = await pushManager()
  if (!manager || !vapidKey) return set('unsupported')
  const subscription = await manager.subscribe({
    userVisibleOnly: true, // the only mode iOS allows: every push shows a notification
    applicationServerKey: base64UrlToBytes(vapidKey),
  })
  try {
    await saveSubscription(subscription)
  } catch (e) {
    // Not on the server means no alerts: don't show "on".
    await subscription.unsubscribe()
    throw e
  }
  set('on')
}

/**
 * Also called on log out, so the next account on this phone has to opt in
 * itself. The browser side goes first: once it is unsubscribed nothing can
 * arrive, even if the row delete fails (the server drops the row the next
 * time the push service answers 410).
 */
export async function turnOffRestPush() {
  const manager = await pushManager()
  const subscription = await manager?.getSubscription()
  if (!subscription) return set(state === 'on' ? 'off' : state)
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  set('off')
  unwrap(await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint))
}
