import { describe, expect, it } from 'vitest'
import type { ExerciseKind, PreviousSet } from '../../types/db'
import {
  addSet,
  applySuggestions,
  describeImprovement,
  emptySet,
  improvementOver,
  newDraft,
  parseNumber,
  toSavePayload,
  toggleSetComplete,
  updateSet,
  type WorkoutDraft,
} from './draft'

const bench = { id: 'ex-bench', name: 'Bench Press', kind: 'weight_reps' as const }
const plank = { id: 'ex-plank', name: 'Plank', kind: 'duration' as const }
const pullUp = { id: 'ex-pullup', name: 'Pull Up', kind: 'bodyweight_reps' as const }

function draftWith(...exercises: { id: string; name: string; kind: ExerciseKind }[]): WorkoutDraft {
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
    d = updateSet(d, ex.id, ex.sets[0].id, { reps: '5' })
    d = toggleSetComplete(d, ex.id, ex.sets[0].id, undefined, 1_000)
    d = toggleSetComplete(d, ex.id, ex.sets[0].id, undefined, 5_000)
    expect(d.exercises[0].sets[0].completed).toBe(false)
    expect(d.restEndsAt).toBe(121_000)
  })

  it('refuses to tick a set with no reps and nothing to fill from', () => {
    const d = draftWith(pullUp)
    const ex = d.exercises[0]
    const next = toggleSetComplete(d, ex.id, ex.sets[0].id, undefined)
    expect(next).toBe(d) // unchanged: no tick, no rest timer
  })

  it('refuses zero reps, including a bad "0 reps" previous set', () => {
    let d = draftWith(pullUp)
    const ex = d.exercises[0]
    const badPrev = {
      exercise_id: 'ex-pullup',
      position: 0,
      set_type: 'normal' as const,
      weight_kg: null,
      reps: 0,
      duration_s: null,
      rpe: null,
    }
    expect(toggleSetComplete(d, ex.id, ex.sets[0].id, badPrev)).toBe(d)
    d = updateSet(d, ex.id, ex.sets[0].id, { reps: '0' })
    expect(toggleSetComplete(d, ex.id, ex.sets[0].id, undefined)).toBe(d)
  })

  it('ticks when reps come from the previous workout', () => {
    const d = draftWith(pullUp)
    const ex = d.exercises[0]
    const prev = {
      exercise_id: 'ex-pullup',
      position: 0,
      set_type: 'normal' as const,
      weight_kg: null,
      reps: 8,
      duration_s: null,
      rpe: null,
    }
    expect(toggleSetComplete(d, ex.id, ex.sets[0].id, prev).exercises[0].sets[0]).toMatchObject({
      completed: true,
      reps: '8',
    })
  })

  it('requires a duration (not reps) for timed exercises; weight is never required', () => {
    let d = draftWith(plank)
    const ex = d.exercises[0]
    d = updateSet(d, ex.id, ex.sets[0].id, { reps: '10', weight: '5' })
    expect(toggleSetComplete(d, ex.id, ex.sets[0].id, undefined)).toBe(d)
    d = updateSet(d, ex.id, ex.sets[0].id, { duration: '45', weight: '' })
    expect(
      toggleSetComplete(d, ex.id, ex.sets[0].id, undefined).exercises[0].sets[0].completed,
    ).toBe(true)
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

  it('stores duration and added weight for duration exercises, but not reps', () => {
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
      weight_kg: 10,
      reps: null,
    })
  })

  it('stores added weight for bodyweight exercises, null when left empty', () => {
    let d = draftWith(pullUp)
    const [p] = d.exercises
    d = updateSet(d, p.id, p.sets[0].id, { weight: '10', reps: '6', completed: true })
    d = updateSet(d, p.id, p.sets[1].id, { weight: '', reps: '8', completed: true })
    expect(toSavePayload(d).exercises[0].sets).toMatchObject([
      { weight_kg: 10, reps: 6 },
      { weight_kg: null, reps: 8 },
    ])
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

describe('improvementOver', () => {
  const prev = (p: Partial<PreviousSet>): PreviousSet => ({
    exercise_id: 'x',
    position: 0,
    set_type: 'normal',
    weight_kg: null,
    reps: null,
    duration_s: null,
    rpe: null,
    ...p,
  })
  const set = (weight: string, reps: string, setType: PreviousSet['set_type'] = 'normal') => ({
    ...emptySet(),
    setType,
    weight,
    reps,
    completed: true,
  })

  it('reports more kg, more reps, or both', () => {
    expect(improvementOver(set('82,5', '8'), prev({ weight_kg: 80, reps: 8 }))).toEqual({
      kg: 2.5,
      reps: 0,
      seconds: 0,
    })
    expect(improvementOver(set('80', '10'), prev({ weight_kg: 80, reps: 8 }))).toEqual({
      kg: 0,
      reps: 2,
      seconds: 0,
    })
    expect(improvementOver(set('85', '9'), prev({ weight_kg: 80, reps: 8 }))).toEqual({
      kg: 5,
      reps: 1,
      seconds: 0,
    })
  })

  it('counts heavier with fewer reps as progress, as specified', () => {
    expect(improvementOver(set('90', '5'), prev({ weight_kg: 80, reps: 8 }))?.kg).toBe(10)
  })

  it('returns null when equal or worse', () => {
    expect(improvementOver(set('80', '8'), prev({ weight_kg: 80, reps: 8 }))).toBeNull()
    expect(improvementOver(set('75', '6'), prev({ weight_kg: 80, reps: 8 }))).toBeNull()
  })

  it('treats empty weight as bodyweight (0 kg added)', () => {
    expect(improvementOver(set('', '10'), prev({ reps: 8 }))).toEqual({
      kg: 0,
      reps: 2,
      seconds: 0,
    })
    expect(improvementOver(set('5', '8'), prev({ reps: 8 }))?.kg).toBe(5)
  })

  it('ignores warm-ups and sets with no previous', () => {
    expect(improvementOver(set('100', '10', 'warmup'), prev({ weight_kg: 60, reps: 5 }))).toBeNull()
    expect(
      improvementOver(set('100', '10'), prev({ weight_kg: 60, reps: 5, set_type: 'warmup' })),
    ).toBeNull()
    expect(improvementOver(set('100', '10'), undefined)).toBeNull()
  })

  it('avoids floating point noise in the kg difference', () => {
    expect(improvementOver(set('80,3', '8'), prev({ weight_kg: 80.1, reps: 8 }))?.kg).toBe(0.2)
  })
})

describe('describeImprovement', () => {
  it('lists only what improved', () => {
    expect(describeImprovement({ kg: 2.5, reps: 1, seconds: 0 })).toBe('+2.5 kg · +1 rep')
    expect(describeImprovement({ kg: 0, reps: 3, seconds: 0 })).toBe('+3 reps')
  })
})

describe('toSavePayload with an old draft', () => {
  it('drops ticked sets that have no reps (drafts saved before ticking was validated)', () => {
    let d = draftWith(pullUp)
    const [p] = d.exercises
    // Bypasses toggleSetComplete on purpose: this is what an old localStorage draft can hold.
    d = updateSet(d, p.id, p.sets[0].id, { reps: '', completed: true })
    d = updateSet(d, p.id, p.sets[1].id, { reps: '6', completed: true })
    expect(toSavePayload(d).exercises[0].sets).toHaveLength(1)
    expect(toSavePayload(d).exercises[0].sets[0].reps).toBe(6)
  })
})

describe('applySuggestions', () => {
  it('fills empty fields of unticked sets by position, keeping what was typed', () => {
    let d = draftWith(bench)
    const ex = d.exercises[0]
    d = addSet(d, ex.id)
    const [s1, s2, s3] = d.exercises[0].sets
    d = updateSet(d, ex.id, s1.id, { weight: '80', reps: '8', completed: true })
    d = updateSet(d, ex.id, s2.id, { weight: '85' })

    const t = { weight: 82.5, reps: 9, duration: null }
    const sets = applySuggestions(d, ex.id, [t, t, null]).exercises[0].sets

    expect(sets[0]).toMatchObject({ weight: '80', reps: '8' }) // ticked: untouched
    expect(sets[1]).toMatchObject({ weight: '85', reps: '9' }) // typed weight kept
    expect(sets[2]).toMatchObject({ id: s3.id, weight: '', reps: '' }) // no suggestion for it
  })
})
