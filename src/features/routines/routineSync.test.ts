import { describe, expect, it } from 'vitest'
import type { Routine } from '../../types/db'
import { newDraft, type WorkoutDraft } from '../workout/draft'
import {
  describeChanges,
  doneExercises,
  hasChanges,
  routineChanges,
  routineInputFrom,
  type DoneExercise,
} from './routineSync'

const exercise = (id: string, name: string) => ({
  id,
  user_id: null,
  name,
  muscle_group: 'mid-chest',
  equipment: 'barbell',
  kind: 'weight_reps' as const,
  image_path: null,
})
const bench = exercise('bench', 'Bench Press')
const ohp = exercise('ohp', 'Overhead Press')
const dips = exercise('dips', 'Dips')
const fly = exercise('fly', 'Cable Fly')

function routine(...entries: [ReturnType<typeof exercise>, number, number?][]): Routine {
  return {
    id: 'r1',
    name: 'Push',
    notes: 'Heavy day',
    folder_id: 'f1',
    created_at: '2026-11-01',
    routine_exercises: entries.map(([e, sets, rest = 90], i) => ({
      id: `re${i}`,
      exercise_id: e.id,
      position: i,
      target_sets: sets,
      rest_seconds: rest,
      exercise: e,
    })),
  }
}

const done = (e: ReturnType<typeof exercise>, sets: number, restSeconds = 90): DoneExercise => ({
  exerciseId: e.id,
  name: e.name,
  sets,
  restSeconds,
})

const push = routine([bench, 3, 150], [ohp, 3], [dips, 2])

describe('routineChanges', () => {
  it('none when the workout followed the routine', () => {
    const c = routineChanges(push, [done(bench, 3), done(ohp, 3), done(dips, 2)])
    expect(hasChanges(c)).toBe(false)
  })

  it('an added, a removed and a swapped exercise', () => {
    // Dips replaced by Cable Fly, Overhead Press skipped.
    const c = routineChanges(push, [done(bench, 3), done(fly, 3)])
    expect(c).toEqual({
      added: [{ name: 'Cable Fly', sets: 3 }],
      removed: [{ name: 'Overhead Press' }, { name: 'Dips' }],
      sets: [],
      reordered: false,
    })
  })

  it('a different number of sets', () => {
    const c = routineChanges(push, [done(bench, 4), done(ohp, 3), done(dips, 1)])
    expect(c.sets).toEqual([
      { name: 'Bench Press', from: 3, to: 4 },
      { name: 'Dips', from: 2, to: 1 },
    ])
    expect(c.reordered).toBe(false)
  })

  it('a new order, but not when only adding or removing shifts the rest', () => {
    expect(routineChanges(push, [done(ohp, 3), done(bench, 3), done(dips, 2)]).reordered).toBe(true)
    expect(routineChanges(push, [done(fly, 3), done(bench, 3), done(dips, 2)]).reordered).toBe(
      false,
    )
  })

  it('the same exercise twice matches by occurrence', () => {
    const twice = routine([bench, 3], [ohp, 3], [bench, 2])
    expect(hasChanges(routineChanges(twice, [done(bench, 3), done(ohp, 3), done(bench, 2)]))).toBe(
      false,
    )
    // The second Bench Press dropped: that one is removed, not the first.
    expect(routineChanges(twice, [done(bench, 3), done(ohp, 3)])).toEqual({
      added: [],
      removed: [{ name: 'Bench Press' }],
      sets: [],
      reordered: false,
    })
  })
})

describe('doneExercises', () => {
  it('counts saved sets only, and drops an exercise with none', () => {
    const draft: WorkoutDraft = newDraft({
      name: 'Push',
      routineId: 'r1',
      exercises: [
        { exercise: bench, sets: 3, restSeconds: 150 },
        { exercise: ohp, sets: 3, restSeconds: 90 },
      ],
    })
    const [b, o] = draft.exercises
    b.sets[0] = { ...b.sets[0], reps: '5', completed: true }
    b.sets[1] = { ...b.sets[1], reps: '5', completed: true }
    // Ticked but without reps: not saved, so not counted.
    o.sets[0] = { ...o.sets[0], reps: '', completed: true }

    expect(doneExercises(draft)).toEqual([done(bench, 2, 150)])
  })
})

describe('describeChanges', () => {
  it('one line per change', () => {
    expect(
      describeChanges({
        added: [{ name: 'Cable Fly', sets: 1 }],
        removed: [{ name: 'Dips' }],
        sets: [{ name: 'Bench Press', from: 3, to: 4 }],
        reordered: true,
      }),
    ).toEqual([
      'Add Cable Fly, 1 set',
      'Remove Dips',
      'Bench Press: 3 → 4 sets',
      'New exercise order',
    ])
  })
})

describe('routineInputFrom', () => {
  it('the workout exercises; name, notes, folder and known rest times kept', () => {
    // Bench rest changed to 60 s for the day; Cable Fly is new at 45 s.
    expect(routineInputFrom(push, [done(bench, 4, 60), done(fly, 3, 45)])).toEqual({
      id: 'r1',
      name: 'Push',
      notes: 'Heavy day',
      folder_id: 'f1',
      exercises: [
        { exercise_id: 'bench', target_sets: 4, rest_seconds: 150 },
        { exercise_id: 'fly', target_sets: 3, rest_seconds: 45 },
      ],
    })
  })
})
