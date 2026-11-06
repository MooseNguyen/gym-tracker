import { describe, expect, it } from 'vitest'
import {
  addSet,
  newDraft,
  parseNumber,
  toSavePayload,
  toggleSetComplete,
  updateSet,
  type WorkoutDraft,
} from './draft'

const bench = { id: 'ex-bench', name: 'Bench Press', kind: 'weight_reps' as const }
const plank = { id: 'ex-plank', name: 'Plank', kind: 'duration' as const }

function draftWith(...exercises: (typeof bench | typeof plank)[]): WorkoutDraft {
  return newDraft(
    {
      name: 'Push',
      exercises: exercises.map((exercise) => ({ exercise, sets: 2, restSeconds: 120 })),
    },
    new Date('2026-01-01T10:00:00Z'),
  )
}

describe('parseNumber', () => {
  it('accepts a comma as decimal separator', () => {
    expect(parseNumber('62,5')).toBe(62.5)
    expect(parseNumber(' 80 ')).toBe(80)
  })

  it('returns null for empty, invalid or negative input', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('-5')).toBeNull()
  })
})

describe('addSet', () => {
  it('copies the numbers of the last set but not its completion', () => {
    let d = draftWith(bench)
    const ex = d.exercises[0]
    d = updateSet(d, ex.id, ex.sets[1].id, { weight: '100', reps: '5', completed: true })
    d = addSet(d, ex.id)
    const added = d.exercises[0].sets[2]
    expect(added).toMatchObject({ weight: '100', reps: '5', completed: false, setType: 'normal' })
  })
})

describe('toggleSetComplete', () => {
  it('fills empty fields from the previous workout and starts the rest timer', () => {
    const d = draftWith(bench)
    const ex = d.exercises[0]
    const previous = {
      exercise_id: 'ex-bench',
      position: 0,
      set_type: 'normal' as const,
      weight_kg: 90,
      reps: 8,
      duration_s: null,
      rpe: null,
    }
    const next = toggleSetComplete(d, ex.id, ex.sets[0].id, previous, 1_000)
    expect(next.exercises[0].sets[0]).toMatchObject({ completed: true, weight: '90', reps: '8' })
    expect(next.restEndsAt).toBe(1_000 + 120_000)
  })

  it('keeps values the user already typed', () => {
    let d = draftWith(bench)
    const ex = d.exercises[0]
    d = updateSet(d, ex.id, ex.sets[0].id, { weight: '95' })
    const previous = {
      exercise_id: 'ex-bench',
      position: 0,
      set_type: 'normal' as const,
      weight_kg: 90,
      reps: 8,
      duration_s: null,
      rpe: null,
    }
    const next = toggleSetComplete(d, ex.id, ex.sets[0].id, previous)
    expect(next.exercises[0].sets[0]).toMatchObject({ weight: '95', reps: '8' })
  })

  it('un-ticks without touching the rest timer', () => {
    let d = draftWith(bench)
    const ex = d.exercises[0]
    d = toggleSetComplete(d, ex.id, ex.sets[0].id, undefined, 1_000)
    d = toggleSetComplete(d, ex.id, ex.sets[0].id, undefined, 5_000)
    expect(d.exercises[0].sets[0].completed).toBe(false)
    expect(d.restEndsAt).toBe(121_000)
  })
})

describe('toSavePayload', () => {
  it('keeps only completed sets and drops exercises without any', () => {
    let d = draftWith(bench, plank)
    const [b] = d.exercises
    d = updateSet(d, b.id, b.sets[0].id, { weight: '100', reps: '5', completed: true })
    d = updateSet(d, b.id, b.sets[1].id, { weight: '100', reps: '5' }) // not completed

    const p = toSavePayload(d, new Date('2026-01-01T11:00:00Z'))
    expect(p.exercises).toHaveLength(1)
    expect(p.exercises[0]).toEqual({
      exercise_id: 'ex-bench',
      notes: null,
      sets: [{ set_type: 'normal', weight_kg: 100, reps: 5, duration_s: null, rpe: null }],
    })
    expect(p.ended_at).toBe('2026-01-01T11:00:00.000Z')
  })

  it('stores duration for duration exercises and ignores weight/reps', () => {
    let d = draftWith(plank)
    const [pl] = d.exercises
    d = updateSet(d, pl.id, pl.sets[0].id, {
      duration: '60',
      weight: '10',
      reps: '3',
      completed: true,
    })
    expect(toSavePayload(d).exercises[0].sets[0]).toMatchObject({
      duration_s: 60,
      weight_kg: null,
      reps: null,
    })
  })

  it('drops an out-of-range RPE instead of failing the save', () => {
    let d = draftWith(bench)
    const [b] = d.exercises
    d = updateSet(d, b.id, b.sets[0].id, { weight: '100', reps: '5', rpe: '15', completed: true })
    expect(toSavePayload(d).exercises[0].sets[0].rpe).toBeNull()
  })

  it('keeps the original end time when editing a saved workout', () => {
    const d = { ...draftWith(bench), mode: 'edit' as const, endedAt: '2026-01-01T10:45:00.000Z' }
    expect(toSavePayload(d, new Date('2026-03-01')).ended_at).toBe('2026-01-01T10:45:00.000Z')
  })
})
