import { describe, expect, it } from 'vitest'
import type { PreviousSet, SetType } from '../../types/db'
import { headlineSuggestion, loadStep, suggestSet, suggestSets } from './progression'

const prev = (
  weight_kg: number | null,
  reps: number | null,
  opts: { rpe?: number; type?: SetType; duration?: number } = {},
): PreviousSet => ({
  exercise_id: 'e',
  position: 0,
  set_type: opts.type ?? 'normal',
  weight_kg,
  reps,
  duration_s: opts.duration ?? null,
  rpe: opts.rpe ?? null,
})

describe('loadStep', () => {
  it('uses the usual smallest jump per equipment', () => {
    expect(loadStep('barbell', 'kg')).toBe(2.5)
    expect(loadStep('machine', 'kg')).toBe(2.5)
    expect(loadStep('dumbbell', 'kg')).toBe(2)
    expect(loadStep('kettlebell', 'kg')).toBe(4)
    expect(loadStep('bodyweight', 'kg')).toBeNull()
    expect(loadStep('band', 'kg')).toBeNull()
    expect(loadStep(undefined, 'kg')).toBe(2.5) // drafts from before equipment was stored
  })
})

describe('suggestSet with RPE', () => {
  it('easy (≤7): more load, same reps', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(80, 8, { rpe: 7 }), 'kg')).toMatchObject({
      weight: 82.5,
      reps: 8,
      reason: 'rpe-easy',
      rpe: 7,
    })
  })

  it('hard (8–9): same load, one more rep', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(80, 8, { rpe: 8.5 }), 'kg')).toMatchObject({
      weight: 80,
      reps: 9,
      reason: 'rpe-hard',
    })
  })

  it('maximal (≥9.5): repeat', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(80, 8, { rpe: 10 }), 'kg')).toMatchObject({
      weight: 80,
      reps: 8,
      reason: 'rpe-max',
    })
  })

  it('RPE wins over the rep range', () => {
    // 12 reps would trigger more load without RPE; RPE 9 says one more rep.
    expect(suggestSet('weight_reps', 'barbell', prev(60, 12, { rpe: 9 }), 'kg')?.weight).toBe(60)
  })
})

describe('suggestSet without RPE (double progression 8–12)', () => {
  it('adds a rep below the top of the range', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(80, 8), 'kg')).toMatchObject({
      weight: 80,
      reps: 9,
      reason: 'next-rep',
    })
  })

  it('at the top: more load, back to the bottom', () => {
    expect(suggestSet('weight_reps', 'dumbbell', prev(20, 12), 'kg')).toMatchObject({
      weight: 22,
      reps: 8,
      reason: 'top-of-range',
    })
  })

  it('keeps decimals tidy', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(42.5, 12), 'kg')?.weight).toBe(45)
  })
})

describe('suggestSet edge cases', () => {
  it('bodyweight and band: reps only, even when easy', () => {
    expect(
      suggestSet('bodyweight_reps', 'bodyweight', prev(null, 10, { rpe: 6 }), 'kg'),
    ).toMatchObject({
      weight: null,
      reps: 11,
    })
    expect(suggestSet('weight_reps', 'band', prev(10, 12), 'kg')).toMatchObject({
      weight: 10,
      reps: 13,
    })
  })

  it('timed: five more seconds', () => {
    expect(
      suggestSet('duration', 'bodyweight', prev(null, null, { duration: 60 }), 'kg'),
    ).toMatchObject({
      duration: 65,
    })
  })

  it('warm-ups and failure sets are repeated', () => {
    expect(
      suggestSet('weight_reps', 'barbell', prev(40, 10, { type: 'warmup' }), 'kg'),
    ).toMatchObject({
      weight: 40,
      reps: 10,
      reason: 'hold',
    })
    expect(
      suggestSet('weight_reps', 'barbell', prev(80, 6, { type: 'failure' }), 'kg')?.reason,
    ).toBe('hold')
  })

  it('nothing to build on: no suggestion', () => {
    expect(suggestSet('weight_reps', 'barbell', undefined, 'kg')).toBeNull()
    expect(suggestSet('weight_reps', 'barbell', prev(80, null), 'kg')).toBeNull()
    expect(suggestSet('duration', 'bodyweight', prev(null, null), 'kg')).toBeNull()
  })
})

describe('headlineSuggestion', () => {
  it('headlines the first working set, skipping warm-ups', () => {
    const p = [prev(40, 10, { type: 'warmup' }), prev(80, 8), prev(80, 7)]
    const s = suggestSets('weight_reps', 'barbell', p, 'kg')
    expect(headlineSuggestion(p, s)).toMatchObject({ weight: 80, reps: 9 })
    expect(headlineSuggestion([], [])).toBeNull()
  })
})

describe('suggestions in lb', () => {
  it('steps in lb plates, from last time stored in kg', () => {
    // 135 lb was saved as 61.25 kg; easy last time → +5 lb, not +2.5 kg (5.5 lb).
    expect(suggestSet('weight_reps', 'barbell', prev(61.25, 8, { rpe: 7 }), 'lb')).toMatchObject({
      weight: 140,
      reps: 8,
    })
    expect(loadStep('dumbbell', 'lb')).toBe(5)
  })

  it('repeats last time in lb when holding', () => {
    expect(suggestSet('weight_reps', 'barbell', prev(61.25, 8, { rpe: 10 }), 'lb')?.weight).toBe(
      135,
    )
  })
})
