import { describe, expect, it } from 'vitest'
import type { Exercise, SetRow, SetType, Workout } from '../../types/db'
import { groupVolumes, SET_GROUPS, volumeStatus, weekRange } from './muscleVolume'

let n = 0
const sets = (count: number, set_type: SetType = 'normal'): SetRow[] =>
  Array.from({ length: count }, () => ({
    id: `s${n++}`,
    position: 0,
    set_type,
    weight_kg: 50,
    reps: 10,
    duration_s: null,
    rpe: null,
  }))

const ex = (muscle_group: string): Exercise => ({
  id: muscle_group,
  user_id: null,
  name: muscle_group,
  muscle_group,
  equipment: 'barbell',
  kind: 'weight_reps',
  image_path: null,
})

const workout = (...items: [string, SetRow[]][]): Workout => ({
  id: `w${n++}`,
  routine_id: null,
  name: 'W',
  started_at: '2026-11-03T10:00:00Z',
  ended_at: '2026-11-03T11:00:00Z',
  notes: null,
  workout_exercises: items.map(([m, s], i) => ({
    id: `we${n++}`,
    exercise_id: m,
    position: i,
    notes: null,
    exercise: ex(m),
    sets: s,
  })),
})

describe('volumeStatus', () => {
  it('compares against the 10–20 weekly sets guideline', () => {
    expect(volumeStatus(0)).toBe('none')
    expect(volumeStatus(9)).toBe('low')
    expect(volumeStatus(10)).toBe('ok')
    expect(volumeStatus(20)).toBe('ok')
    expect(volumeStatus(21)).toBe('high')
  })
})

describe('groupVolumes', () => {
  const week = [
    workout(['mid-chest', sets(4)], ['upper-chest', sets(3)], ['triceps', sets(3, 'warmup')]),
    workout(['lats', sets(6)], ['back', sets(2)], ['upper-back', sets(4)]),
    workout(['mid-chest', sets(4)], ['cardio', sets(1)]),
  ]
  const byGroup = Object.fromEntries(groupVolumes(week).map((g) => [g.group, g]))

  it('lists every set-based group in app order, cardio excluded', () => {
    expect(groupVolumes(week).map((g) => g.group)).toEqual(SET_GROUPS)
    expect(byGroup.cardio).toBeUndefined()
  })

  it('adds sub-muscles and the legacy plain value into their group', () => {
    expect(byGroup.chest).toMatchObject({ sets: 11, status: 'ok' })
    expect(byGroup.back).toMatchObject({ sets: 12, status: 'ok' })
  })

  it('keeps per-target numbers, with "general" only when used', () => {
    expect(byGroup.chest.muscles).toEqual([
      { muscle: 'upper-chest', sets: 3 },
      { muscle: 'mid-chest', sets: 8 },
      { muscle: 'lower-chest', sets: 0 },
    ])
    expect(byGroup.back.muscles.at(-1)).toEqual({ muscle: 'back', sets: 2 })
    expect(byGroup.biceps.muscles).toEqual([]) // no sub-muscles
  })

  it('ignores warm-ups and shows untrained groups as 0', () => {
    expect(byGroup.triceps).toMatchObject({ sets: 0, status: 'none' })
    expect(byGroup.quads.sets).toBe(0)
  })

  it('handles no workouts', () => {
    expect(groupVolumes([]).every((g) => g.sets === 0)).toBe(true)
  })
})

describe('weekRange', () => {
  // Tests run in Europe/Berlin (see vite.config.ts), where DST ends on 25 Oct 2026.
  it('runs Monday 00:00 to the next Monday 00:00, local time', () => {
    const { from, to } = weekRange(new Date(2026, 10, 6, 15)) // Fri 6 Nov
    expect(from).toEqual(new Date(2026, 10, 2))
    expect(to).toEqual(new Date(2026, 10, 9))
  })

  it('moves by whole weeks, across the DST change', () => {
    const { from, to } = weekRange(new Date(2026, 10, 6), -2)
    expect(from).toEqual(new Date(2026, 9, 19))
    expect(to).toEqual(new Date(2026, 9, 26)) // the 25 Oct week is 169 hours long
    expect(to.getHours()).toBe(0)
  })
})

describe('groupVolumes with secondary muscles', () => {
  it('counts a set for the primary group and for each secondary group', () => {
    const w = workout(['mid-chest', sets(4)])
    w.workout_exercises[0].exercise.secondary_muscles = ['triceps', 'front-delts']
    const byGroup = Object.fromEntries(groupVolumes([w]).map((g) => [g.group, g.sets]))
    expect(byGroup).toMatchObject({ chest: 4, triceps: 4, shoulders: 4, back: 0 })
  })
})
