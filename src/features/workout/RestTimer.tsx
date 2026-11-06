import { useEffect, useRef } from 'react'
import { setDraft } from './draftStore'
import { formatDuration, useNow } from './useNow'

export function RestTimer({ endsAt }: { endsAt: number }) {
  const now = useNow(250)
  const remaining = Math.ceil((endsAt - now) / 1000)
  const notified = useRef(false)

  useEffect(() => {
    notified.current = false
  }, [endsAt])

  useEffect(() => {
    if (remaining <= 0 && !notified.current) {
      notified.current = true
      // Vibration is ignored on iOS; Android buzzes.
      navigator.vibrate?.([200, 100, 200])
    }
  }, [remaining])

  const adjust = (deltaSeconds: number) =>
    setDraft((d) => ({
      ...d,
      restEndsAt: d.restEndsAt ? d.restEndsAt + deltaSeconds * 1000 : null,
    }))

  const done = remaining <= 0
  return (
    <div className={done ? 'rest-timer done' : 'rest-timer'} role="timer" aria-live="polite">
      <button className="btn small" onClick={() => adjust(-15)} aria-label="15 seconds less">
        −15
      </button>
      <span className="rest-time">{done ? 'Rest over' : formatDuration(remaining)}</span>
      <button className="btn small" onClick={() => adjust(15)} aria-label="15 seconds more">
        +15
      </button>
      <button className="btn small" onClick={() => setDraft((d) => ({ ...d, restEndsAt: null }))}>
        {done ? 'Close' : 'Skip'}
      </button>
    </div>
  )
}
