import { describe, expect, it } from 'vitest'
import { formatSet, formatSetValues } from './format'

const v = (weight_kg: number | null, reps: number | null, duration_s: number | null = null) => ({
  weight_kg,
  reps,
  duration_s,
})

describe('formatSetValues', () => {
  it('shows kg × reps for weighted exercises', () => {
    expect(formatSetValues('weight_reps', v(80, 8), 'kg')).toBe('80 kg × 8')
    expect(formatSetValues('weight_reps', v(null, 8), 'kg')).toBe('0 kg × 8')
  })

  it('shows BW for bodyweight without added weight, kg when weighted', () => {
    expect(formatSetValues('bodyweight_reps', v(null, 12), 'kg')).toBe('BW × 12')
    expect(formatSetValues('bodyweight_reps', v(0, 12), 'kg')).toBe('BW × 12')
    expect(formatSetValues('bodyweight_reps', v(10, 6), 'kg')).toBe('10 kg × 6')
  })

  it('shows seconds for timed sets, with weight when added', () => {
    expect(formatSetValues('duration', v(null, null, 60), 'kg')).toBe('60s')
    expect(formatSetValues('duration', v(10, null, 45), 'kg')).toBe('10 kg · 45s')
  })
})

describe('formatSet', () => {
  it('prefixes non-normal set types and appends RPE', () => {
    expect(formatSet('weight_reps', { ...v(100, 3), set_type: 'failure', rpe: 9.5 }, 'kg')).toBe(
      'F · 100 kg × 3 @9.5',
    )
    expect(formatSet('weight_reps', { ...v(60, 10), set_type: 'normal', rpe: null }, 'kg')).toBe(
      '60 kg × 10',
    )
  })
})
