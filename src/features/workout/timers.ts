// Pure timer maths for the workout page. Everything is computed from
// timestamps, never from a counter, so a throttled or suspended page (locked
// phone, background tab) can't make the times drift.

/** Wheel choices for rest and countdown: Off, then every 15 s up to 5:00. */
export const WHEEL_STEP_SECONDS = 15
export const WHEEL_MAX_SECONDS = 300
export const wheelSteps = (current?: number): number[] => {
  const steps = Array.from(
    { length: WHEEL_MAX_SECONDS / WHEEL_STEP_SECONDS + 1 },
    (_, i) => i * WHEEL_STEP_SECONDS,
  )
  // A value from an older routine (e.g. 100 s) stays selectable.
  return current != null && !steps.includes(current)
    ? [...steps, current].sort((a, b) => a - b)
    : steps
}

/** Fraction of a countdown still to go, 1 → 0. Null when the total is unknown (old drafts). */
export function countdownLeft(endsAt: number, totalMs: number | undefined, now: number) {
  if (!totalMs || totalMs <= 0) return null
  return Math.min(1, Math.max(0, (endsAt - now) / totalMs))
}

/** Stopwatch: elapsed time banked so far, plus the start of the running stretch. */
export interface Stopwatch {
  elapsedMs: number
  /** Epoch ms when it was last started; null while paused. */
  startedAt: number | null
}

export const STOPPED: Stopwatch = { elapsedMs: 0, startedAt: null }

export const stopwatchElapsed = (sw: Stopwatch, now: number) =>
  sw.elapsedMs + (sw.startedAt != null ? Math.max(0, now - sw.startedAt) : 0)

export const startStopwatch = (sw: Stopwatch, now: number): Stopwatch =>
  sw.startedAt != null ? sw : { ...sw, startedAt: now }

export const pauseStopwatch = (sw: Stopwatch, now: number): Stopwatch =>
  sw.startedAt == null ? sw : { elapsedMs: stopwatchElapsed(sw, now), startedAt: null }

/** "m:ss.t" with tenths, for the stopwatch. */
export function formatStopwatch(ms: number): string {
  const tenths = Math.floor(ms / 100)
  const s = Math.floor(tenths / 10)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const mm = h > 0 ? String(m % 60).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}.${tenths % 10}`
}

/** "1 min 30 s" for screen readers; "Off" for 0. */
export function spokenSeconds(sec: number): string {
  if (sec === 0) return 'Off'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return [m ? `${m} min` : '', s ? `${s} s` : ''].filter(Boolean).join(' ')
}
