import { describe, expect, it } from 'vitest'
import { countThisWeek, dayKey, startOfWeek, stripDays, workoutsByDay } from './calendar'

// Local-time constructor: month is 0-based. 2026-11-06 is a Friday.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

describe('dayKey', () => {
  it('formats the local date with zero padding', () => {
    expect(dayKey(local(2026, 1, 5))).toBe('2026-01-05')
  })

  it('uses local time, so late evening stays on the same day', () => {
    expect(dayKey(local(2026, 11, 6, 23, 45))).toBe('2026-11-06')
  })
})

describe('startOfWeek', () => {
  it('goes back to Monday', () => {
    expect(dayKey(startOfWeek(local(2026, 11, 6)))).toBe('2026-11-02')
  })

  it('treats Sunday as the end of the week, not the start', () => {
    expect(dayKey(startOfWeek(local(2026, 11, 8)))).toBe('2026-11-02')
  })

  it('keeps Monday itself', () => {
    expect(dayKey(startOfWeek(local(2026, 11, 2, 0, 5)))).toBe('2026-11-02')
  })

  it('crosses a month boundary', () => {
    expect(dayKey(startOfWeek(local(2026, 10, 1)))).toBe('2026-09-28')
  })
})

describe('stripDays', () => {
  const days = stripDays(local(2026, 11, 6), 4)

  it('covers 4 full weeks, Monday to Sunday, ending this week', () => {
    expect(days).toHaveLength(28)
    expect(dayKey(days[0])).toBe('2026-10-12')
    expect(days[0].getDay()).toBe(1)
    expect(dayKey(days[27])).toBe('2026-11-08')
    expect(days[27].getDay()).toBe(0)
  })

  it('has no gaps or repeats, even across the October daylight-saving change', () => {
    const keys = days.map(dayKey)
    expect(new Set(keys).size).toBe(28)
    expect(keys).toContain('2026-10-25') // last Sunday of October (EU DST end)
    expect(keys).toContain('2026-10-26')
  })
})

describe('workoutsByDay / countThisWeek', () => {
  const workouts = [
    { id: 'a', started_at: local(2026, 11, 2, 7).toISOString() },
    { id: 'b', started_at: local(2026, 11, 4, 18).toISOString() },
    { id: 'c', started_at: local(2026, 11, 4, 21).toISOString() }, // second one that day
    { id: 'd', started_at: local(2026, 10, 30, 9).toISOString() }, // last week
  ]
  const byDay = workoutsByDay(workouts)

  it('groups workout ids per local day', () => {
    expect(byDay.get('2026-11-04')).toEqual(['b', 'c'])
    expect(byDay.get('2026-11-02')).toEqual(['a'])
  })

  it('counts only the current Monday–Sunday', () => {
    expect(countThisWeek(byDay, local(2026, 11, 6))).toBe(3)
  })
})
