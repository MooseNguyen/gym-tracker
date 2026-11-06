import { useEffect } from 'react'

export interface Celebration {
  /** Changes on every celebration, so the same text twice still re-triggers. */
  id: number
  exercise: string
  text: string
}

const VISIBLE_MS = 2600

/**
 * The text part of the "you beat last time" moment. It lives in HTML (not in
 * the WebGL canvas) so screen readers announce it and it works without WebGL.
 */
export function PrBanner({
  celebration,
  onDone,
}: {
  celebration: Celebration | null
  onDone: () => void
}) {
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(onDone, VISIBLE_MS)
    return () => clearTimeout(t)
  }, [celebration, onDone])

  return (
    <div className="pr-banner-slot" role="status" aria-live="polite">
      {celebration && (
        <div key={celebration.id} className="pr-banner">
          <span className="pr-banner-icon" aria-hidden="true">
            🔥
          </span>
          <div>
            <strong>Beat last time!</strong>
            <div className="pr-banner-detail">
              {celebration.exercise}: {celebration.text}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
