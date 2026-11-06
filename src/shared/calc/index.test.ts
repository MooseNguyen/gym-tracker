import { describe, expect, it } from 'vitest'
import { estimate1RM, personalRecords, summarizeSession, totalVolume, type CalcSet } from '.'

const set = (
  weight_kg: number | null,
  reps: number | null,
  set_type: CalcSet['set_type'] = 'normal',
) => ({
  weight_kg,
  reps,
  set_type,
})

describe('estimate1RM', () => {
  it('uses Epley for multi-rep sets', () => {
    expect(estimate1RM(100, 5)).toBe(116.7)
  })

  it('returns the weight itself for a single rep', () => {
    expect(estimate1RM(140, 1)).toBe(140)
  })

  it('returns null for zero reps, zero weight or missing values', () => {
    expect(estimate1RM(100, 0)).toBeNull()
    expect(estimate1RM(0, 10)).toBeNull()
    expect(estimate1RM(null, 5)).toBeNull()
    expect(estimate1RM(100, null)).toBeNull()
  })
})

describe('totalVolume', () => {
  it('sums weight x reps and ignores warm-ups', () => {
    expect(totalVolume([set(40, 10, 'warmup'), set(100, 5), set(100, 5), set(80, 8, 'drop')])).toBe(
      1640,
    )
  })

  it('treats missing values as zero', () => {
    expect(totalVolume([set(null, 10), set(50, null)])).toBe(0)
  })

  it('is zero for an empty list', () => {
    expect(totalVolume([])).toBe(0)
  })
})

describe('summarizeSession', () => {
  it('ignores warm-ups even when they are heavier', () => {
    const s = summarizeSession('2026-01-01', [set(120, 1, 'warmup'), set(100, 5)])
    expect(s.heaviestKg).toBe(100)
    expect(s.bestE1RM).toBe(116.7)
  })

  it('does not count a weight with zero reps as the heaviest lift', () => {
    const s = summarizeSession('2026-01-01', [set(150, 0, 'failure'), set(100, 3)])
    expect(s.heaviestKg).toBe(100)
  })

  it('returns nulls for bodyweight sets without weight', () => {
    const s = summarizeSession('2026-01-01', [set(null, 12), set(null, 10)])
    expect(s.bestE1RM).toBeNull()
    expect(s.heaviestKg).toBeNull()
    expect(s.bestReps).toBe(12)
    expect(s.volume).toBe(0)
  })
})

describe('personalRecords', () => {
  it('picks the best value and the date it was first reached', () => {
    const prs = personalRecords([
      summarizeSession('2026-01-08', [set(100, 5)]),
      summarizeSession('2026-01-01', [set(100, 5)]),
      summarizeSession('2026-01-15', [set(90, 8)]),
    ])
    expect(prs.bestE1RM).toEqual({ value: 116.7, date: '2026-01-01' })
    expect(prs.heaviestKg).toEqual({ value: 100, date: '2026-01-01' })
    expect(prs.bestReps).toEqual({ value: 8, date: '2026-01-15' })
    expect(prs.bestSessionVolume).toEqual({ value: 720, date: '2026-01-15' })
  })

  it('returns nulls when there is no history', () => {
    expect(personalRecords([])).toEqual({
      bestE1RM: null,
      heaviestKg: null,
      bestSessionVolume: null,
      bestReps: null,
    })
  })
})
