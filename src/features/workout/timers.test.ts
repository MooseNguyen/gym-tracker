import { describe, expect, it } from 'vitest'
import {
  countdownLeft,
  formatStopwatch,
  pauseStopwatch,
  spokenSeconds,
  startStopwatch,
  STOPPED,
  stopwatchElapsed,
  wheelSteps,
} from './timers'

describe('wheelSteps', () => {
  it('runs from Off to 5:00 in 15 s steps', () => {
    const steps = wheelSteps()
    expect(steps).toHaveLength(21)
    expect(steps.slice(0, 3)).toEqual([0, 15, 30])
    expect(steps.at(-1)).toBe(300)
  })

  it('keeps an odd value from an older routine selectable', () => {
    expect(wheelSteps(100)).toContain(100)
    expect(wheelSteps(90)).toHaveLength(21)
  })
})

describe('countdownLeft', () => {
  it('goes from 1 to 0 and clamps past the end', () => {
    expect(countdownLeft(10_000, 10_000, 0)).toBe(1)
    expect(countdownLeft(10_000, 10_000, 7_500)).toBe(0.25)
    expect(countdownLeft(10_000, 10_000, 12_000)).toBe(0)
  })

  it('is null without a total (drafts from before it was stored)', () => {
    expect(countdownLeft(10_000, undefined, 0)).toBeNull()
  })
})

describe('stopwatch', () => {
  it('banks time across pauses and ignores repeated start/pause', () => {
    let sw = startStopwatch(STOPPED, 1_000)
    expect(startStopwatch(sw, 5_000)).toBe(sw) // already running
    expect(stopwatchElapsed(sw, 4_000)).toBe(3_000)

    sw = pauseStopwatch(sw, 4_000)
    expect(sw).toEqual({ elapsedMs: 3_000, startedAt: null })
    expect(pauseStopwatch(sw, 9_000)).toBe(sw) // already paused
    expect(stopwatchElapsed(sw, 60_000)).toBe(3_000) // paused: frozen

    sw = startStopwatch(sw, 10_000)
    expect(stopwatchElapsed(sw, 12_500)).toBe(5_500)
  })

  it('formats with tenths, and hours when needed', () => {
    expect(formatStopwatch(0)).toBe('0:00.0')
    expect(formatStopwatch(83_450)).toBe('1:23.4')
    expect(formatStopwatch(3_723_000)).toBe('1:02:03.0')
  })
})

describe('spokenSeconds', () => {
  it('reads like a person would say it', () => {
    expect(spokenSeconds(0)).toBe('Off')
    expect(spokenSeconds(45)).toBe('45 s')
    expect(spokenSeconds(90)).toBe('1 min 30 s')
    expect(spokenSeconds(120)).toBe('2 min')
  })
})
