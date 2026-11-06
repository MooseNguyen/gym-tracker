import type { Origin } from '../../three/prBurst'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function hasWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/**
 * Visual burst when a set beats last time. The text lives in PrBanner, so this
 * is pure decoration and may silently do nothing:
 * - Reduce Motion on → no particles (the banner still appears, without motion).
 * - No WebGL, or the chunk fails to load (offline before it was cached) → skip.
 * three.js is only downloaded the first time this runs.
 */
export function playCelebration(origin?: Origin): void {
  if (prefersReducedMotion() || !hasWebGL()) return
  const from = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 }
  import('../../three/prBurst')
    .then((m) => m.playBurst(from))
    .catch(() => {
      // Decorative: never let it break logging.
    })
}
