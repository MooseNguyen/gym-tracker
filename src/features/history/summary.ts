import { estimate1RM, totalVolume } from '../../shared/calc'
import { muscleParent, type ExerciseKind, type SetRow, type Workout } from '../../types/db'
import { durationMinutes } from './format'

const isWorking = (s: SetRow) => s.set_type !== 'warmup'

export interface WorkoutStats {
  minutes: number
  exercises: number
  /** Sets that count: everything except warm-ups. */
  workingSets: number
  warmupSets: number
  reps: number
  volume: number
}

/** Headline numbers of one workout. Warm-ups are counted apart and add no volume. */
export function workoutStats(w: Workout): WorkoutStats {
  const sets = w.workout_exercises.flatMap((we) => we.sets)
  const working = sets.filter(isWorking)
  return {
    minutes: durationMinutes(w.started_at, w.ended_at),
    exercises: w.workout_exercises.length,
    workingSets: working.length,
    warmupSets: sets.length - working.length,
    reps: working.reduce((n, s) => n + (s.reps ?? 0), 0),
    volume: totalVolume(sets),
  }
}

export interface ExerciseSummary {
  workingSets: number
  volume: number
  /** The set to show as "best": top e1RM, most reps (bodyweight) or longest (timed). */
  best: SetRow | null
  bestE1RM: number | null
}

export function exerciseSummary(kind: ExerciseKind, sets: SetRow[]): ExerciseSummary {
  const working = sets.filter(isWorking)
  const score = (s: SetRow): number | null => {
    if (kind === 'duration') return s.duration_s || null
    if (kind === 'bodyweight_reps') {
      // More reps wins; at equal reps, more added weight wins.
      return s.reps ? s.reps * 1000 + (s.weight_kg ?? 0) : null
    }
    return estimate1RM(s.weight_kg, s.reps)
  }
  let best: SetRow | null = null
  let bestScore = -Infinity
  for (const s of working) {
    const v = score(s)
    if (v != null && v > bestScore) {
      best = s
      bestScore = v
    }
  }
  return {
    workingSets: working.length,
    volume: totalVolume(working),
    best,
    bestE1RM: kind === 'weight_reps' && best ? estimate1RM(best.weight_kg, best.reps) : null,
  }
}

export interface MuscleSets {
  /** Stored value: a sub-muscle ('lats') or a plain group ('biceps', legacy 'back'). */
  muscle: string
  group: string
  sets: number
}

/**
 * How much a set counts for each secondary muscle. A full set (the owner's
 * choice) overstates volume next to the 10-20 direct sets guideline: 0.5 is
 * the other common convention.
 */
export const SECONDARY_WEIGHT = 1

/**
 * Working sets per muscle, most first (ties keep workout order). Each set
 * counts fully for the exercise's primary muscle; with `secondary`, also
 * SECONDARY_WEIGHT for each secondary muscle in another group (bench press:
 * mid chest, plus triceps and front delts, but not upper chest again).
 * Cardio's sets are time, not sets of a muscle: no secondary credit.
 */
export function setsPerMuscle(w: Workout, { secondary = false } = {}): MuscleSets[] {
  const byMuscle = new Map<string, number>()
  const add = (m: string, n: number) => byMuscle.set(m, (byMuscle.get(m) ?? 0) + n)
  for (const we of w.workout_exercises) {
    const n = we.sets.filter(isWorking).length
    if (n === 0) continue
    const primary = we.exercise.muscle_group
    add(primary, n)
    if (!secondary || primary === 'cardio') continue
    for (const m of we.exercise.secondary_muscles ?? []) {
      if (muscleParent(m) !== muscleParent(primary)) add(m, n * SECONDARY_WEIGHT)
    }
  }
  return [...byMuscle]
    .map(([muscle, sets]) => ({ muscle, group: muscleParent(muscle), sets }))
    .sort((a, b) => b.sets - a.sets)
}

/** Top-level groups trained, most sets first: for the chips on a history card. */
export function groupsTrained(w: Workout): string[] {
  const byGroup = new Map<string, number>()
  for (const m of setsPerMuscle(w)) byGroup.set(m.group, (byGroup.get(m.group) ?? 0) + m.sets)
  return [...byGroup].sort((a, b) => b[1] - a[1]).map(([g]) => g)
}
