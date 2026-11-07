import { useEffect, useRef } from 'react'
import { adjustCountdown, startCountdown } from './draft'
import { setDraft } from './draftStore'
import { countdownLeft } from './timers'
import { formatDuration, useNow } from './useNow'

/** The last seconds get their own look, so a glance is enough. */
const ENDING_SECONDS = 5

export function RestTimer({ endsAt, totalMs }: { endsAt: number; totalMs?: number }) {
  const now = useNow(250)
  const remaining = Math.ceil((endsAt - now) / 1000)
  const left = countdownLeft(endsAt, totalMs, now)
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

  const done = remaining <= 0
  const state = done ? 'done' : remaining <= ENDING_SECONDS ? 'ending' : 'running'
  return (
    <div className={`rest-timer ${state}`} role="timer" aria-live="polite">
      {/* Shrinks as the rest runs out; scaleX, so it never triggers layout. */}
      {left != null && !done && (
        <span
          className="rest-progress"
          aria-hidden="true"
          style={{ transform: `scaleX(${left})` }}
        />
      )}
      <button
        className="btn small"
        onClick={() => setDraft((d) => adjustCountdown(d, -15))}
        aria-label="15 seconds less"
      >
        −15
      </button>
      <span className="rest-time">{done ? 'Rest over' : formatDuration(remaining)}</span>
      <button
        className="btn small"
        onClick={() => setDraft((d) => adjustCountdown(d, 15))}
        aria-label="15 seconds more"
      >
        +15
      </button>
      <button className="btn small" onClick={() => setDraft((d) => startCountdown(d, 0))}>
        {done ? 'Close' : 'Skip'}
      </button>
    </div>
  )
}
