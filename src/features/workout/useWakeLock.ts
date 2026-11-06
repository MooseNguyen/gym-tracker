import { useEffect } from 'react'

/**
 * Keeps the screen on during a workout (Safari 16.4+, Chrome).
 * This is the practical answer to "a PWA cannot notify when rest ends while
 * the phone is locked": the phone simply does not lock.
 * The lock is released by the browser whenever the page is hidden, so it is
 * re-requested when the page becomes visible again.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) l.release()
        else lock = l
      } catch {
        // Denied (e.g. low power mode). Not critical, so fail silently.
      }
    }

    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release()
    }
  }, [active])
}
