import { describe, expect, it } from 'vitest'
import type { Exercise, ExerciseKind, SetRow, SetType, Workout } from '../../types/db'
import { exerciseSummary, groupsTrained, setsPerMuscle, workoutStats } from './summary'

let n = 0
const set = (
  weight_kg: number | null,
  reps: number | null,
  set_type: SetType = 'normal',
  duration_s: number | null = null,
): SetRow => ({ id: `s${n++}`, position: n, set_type, weight_kg, reps, duration_s, rpe: null })

const exercise = (
  name: string,
  muscle_group: string,
  kind: ExerciseKind = 'weight_reps',
): Exercise => ({
  id: name,
  user_id: null,
  name,
  muscle_group,
  equipment: 'barbell',
  kind,
  image_path: null,
})

const workout = (...items: [Exercise, SetRow[]][]): Workout => ({
  id: 'w',
  routine_id: null,
  name: 'Push',
  started_at: '2026-11-06T18:00:00Z',
  ended_at: '2026-11-06T19:05:00Z',
  notes: null,
  workout_exercises: items.map(([exercise, sets], i) => ({
    id: `we${i}`,
    exercise_id: exercise.id,
    position: i,
    notes: null,
    exercise,
    sets,
  })),
})

const bench = exercise('Bench Press', 'mid-chest')
const incline = exercise('Incline Press', 'upper-chest')
const row = exercise('Barbell Row', 'upper-back')
const pullUp = exercise('Pull Up', 'lats', 'bodyweight_reps')
const plank = exercise('Plank', 'core', 'duration')

describe('workoutStats', () => {
  it('counts warm-ups apart and leaves them out of reps and volume', () => {
    const w = workout(
      [bench, [set(40, 10, 'warmup'), set(80, 8), set(80, 6)]],
      [row, [set(60, 10)]],
    )
    expect(workoutStats(w)).toEqual({
      minutes: 65,
      exercises: 2,
      workingSets: 3,
      warmupSets: 1,
      reps: 24,
      volume: 80 * 8 + 80 * 6 + 60 * 10,
    })
  })

  it('handles a workout with no sets', () => {
    const s = workoutStats(workout([bench, []]))
    expect(s).toMatchObject({ workingSets: 0, warmupSets: 0, reps: 0, volume: 0 })
  })
})

describe('exerciseSummary', () => {
  it('picks the set with the best estimated 1RM, ignoring warm-ups', () => {
    const top = set(80, 8)
    const s = exerciseSummary('weight_reps', [set(100, 1, 'warmup'), top, set(90, 2)])
    expect(s.best).toBe(top) // 80×8 → 101.3 beats 90×2 → 96
    expect(s.bestE1RM).toBe(101.3)
    expect(s.workingSets).toBe(2)
    expect(s.volume).toBe(80 * 8 + 90 * 2)
  })

  it('bodyweight: most reps wins, added weight breaks a tie', () => {
    const weighted = set(10, 8)
    expect(exerciseSummary('bodyweight_reps', [set(null, 8), weighted, set(null, 5)]).best).toBe(
      weighted,
    )
    expect(exerciseSummary('bodyweight_reps', [set(null, 8)]).bestE1RM).toBeNull()
  })

  it('timed: longest set wins', () => {
    const long = set(null, null, 'normal', 90)
    expect(exerciseSummary('duration', [set(null, null, 'normal', 60), long]).best).toBe(long)
  })

  it('no best set when nothing was lifted', () => {
    expect(exerciseSummary('weight_reps', [set(null, null)]).best).toBeNull()
    expect(exerciseSummary('weight_reps', []).best).toBeNull()
  })
})

describe('setsPerMuscle / groupsTrained', () => {
  const w = workout(
    [bench, [set(80, 8), set(80, 8), set(40, 10, 'warmup')]],
    [incline, [set(60, 8)]],
    [row, [set(60, 10), set(60, 10), set(60, 10)]],
    [pullUp, [set(null, 8)]],
    [plank, [set(null, null, 'warmup', 30)]], // warm-up only: not trained
  )

  it('counts working sets per primary muscle, most first', () => {
    expect(setsPerMuscle(w)).toEqual([
      { muscle: 'upper-back', group: 'back', sets: 3 },
      { muscle: 'mid-chest', group: 'chest', sets: 2 },
      { muscle: 'upper-chest', group: 'chest', sets: 1 },
      { muscle: 'lats', group: 'back', sets: 1 },
    ])
  })

  it('rolls muscles up into their groups', () => {
    expect(groupsTrained(w)).toEqual(['back', 'chest'])
  })

  it('adds secondary muscles only when asked, a full set each, never twice for one group', () => {
    const w2 = workout(
      // Upper chest is in the primary's group: not counted again.
      [
        { ...bench, secondary_muscles: ['triceps', 'front-delts', 'upper-chest'] },
        [set(80, 8), set(80, 8)],
      ],
      [{ ...row, secondary_muscles: ['biceps', 'rear-delts'] }, [set(60, 10)]],
    )
    expect(setsPerMuscle(w2, { secondary: true })).toEqual([
      { muscle: 'mid-chest', group: 'chest', sets: 2 },
      { muscle: 'triceps', group: 'triceps', sets: 2 },
      { muscle: 'front-delts', group: 'shoulders', sets: 2 },
      { muscle: 'upper-back', group: 'back', sets: 1 },
      { muscle: 'biceps', group: 'biceps', sets: 1 },
      { muscle: 'rear-delts', group: 'shoulders', sets: 1 },
    ])
    // History chips stay on what was trained on purpose.
    expect(groupsTrained(w2)).toEqual(['chest', 'back'])
  })

  it('gives no secondary credit for cardio, whose sets are time', () => {
    const run = { ...exercise('Treadmill', 'cardio', 'duration'), secondary_muscles: ['quads'] }
    expect(
      setsPerMuscle(workout([run, [set(null, null, 'normal', 600)]]), { secondary: true }),
    ).toEqual([{ muscle: 'cardio', group: 'cardio', sets: 1 }])
  })
})

describe('volume in lb', () => {
  it('converts each set before multiplying, so it matches what the lifter typed', () => {
    // 140 lb was stored as 63.5 kg: 63.5 × 8 = 508 kg = 1,119.9 lb, but the sets read 140 lb × 8.
    expect(exerciseSummary('weight_reps', [set(63.5, 8)], 'lb').volume).toBe(1120)
  })
})
