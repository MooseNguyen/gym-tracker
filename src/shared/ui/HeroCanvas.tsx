import { useEffect, useRef } from 'react'

function hasWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/**
 * Decorative 3D dumbbell behind a page header. The container always shows a
 * CSS gradient, so with no WebGL, a failed chunk load, or while three.js is
 * still downloading, the header looks finished, just flat.
 */
export function HeroCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasWebGL()) return
    let disposed = false
    let teardown: (() => void) | undefined

    import('../../three/heroScene')
      .then((m) => {
        // The user may have left the page while the chunk was downloading.
        if (!disposed) teardown = m.createHeroScene(el)
      })
      .catch(() => {
        // Offline before the chunk was cached: keep the gradient.
      })

    return () => {
      disposed = true
      teardown?.()
    }
  }, [])

  return <div ref={ref} className={`hero-canvas ${className ?? ''}`} aria-hidden="true" />
}
