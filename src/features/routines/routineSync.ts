// After a workout started from a routine: how what was done differs from the
// routine, and the save_routine payload that makes the routine match it.
// "What was done" is what Finish saved: exercises with at least one saved set,
// in the workout's order, with that many sets.
import type { Routine } from '../../types/db'
import { isSavedSet, type WorkoutDraft } from '../workout/draft'
import type { RoutineInput } from './api'

export interface DoneExercise {
  exerciseId: string
  name: string
  sets: number
  restSeconds: number
}

export interface RoutineChanges {
  added: { name: string; sets: number }[]
  removed: { name: string }[]
  sets: { name: string; from: number; to: number }[]
  reordered: boolean
}

export function doneExercises(draft: WorkoutDraft): DoneExercise[] {
  return draft.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets.filter((s) => isSavedSet(e.kind, s)).length,
      restSeconds: e.restSeconds,
    }))
    .filter((e) => e.sets > 0)
}

/**
 * Key per entry, so the same exercise twice in a list matches by occurrence:
 * the second Bench Press of the workout is the routine's second Bench Press.
 */
function occurrenceKeys(ids: string[]): string[] {
  const seen = new Map<string, number>()
  return ids.map((id) => {
    const n = seen.get(id) ?? 0
    seen.set(id, n + 1)
    return `${id}#${n}`
  })
}

export function routineChanges(routine: Routine, done: DoneExercise[]): RoutineChanges {
  const planned = routine.routine_exercises
  const plannedKeys = occurrenceKeys(planned.map((re) => re.exercise_id))
  const doneKeys = occurrenceKeys(done.map((e) => e.exerciseId))
  const plannedByKey = new Map(plannedKeys.map((k, i) => [k, planned[i]]))
  const doneKeySet = new Set(doneKeys)

  const changes: RoutineChanges = { added: [], removed: [], sets: [], reordered: false }
  done.forEach((e, i) => {
    const re = plannedByKey.get(doneKeys[i])
    if (!re) changes.added.push({ name: e.name, sets: e.sets })
    else if (re.target_sets !== e.sets)
      changes.sets.push({ name: e.name, from: re.target_sets, to: e.sets })
  })
  planned.forEach((re, i) => {
    if (!doneKeySet.has(plannedKeys[i])) changes.removed.push({ name: re.exercise.name })
  })
  // Order of the exercises both lists share; additions and removals alone are not a reorder.
  const keptInRoutineOrder = plannedKeys.filter((k) => doneKeySet.has(k))
  const keptInWorkoutOrder = doneKeys.filter((k) => plannedByKey.has(k))
  changes.reordered = keptInRoutineOrder.some((k, i) => k !== keptInWorkoutOrder[i])
  return changes
}

export function hasChanges(c: RoutineChanges): boolean {
  return c.added.length > 0 || c.removed.length > 0 || c.sets.length > 0 || c.reordered
}

const setsText = (n: number) => `${n} ${n === 1 ? 'set' : 'sets'}`

/** One line per change, for the "Update routine?" dialog. */
export function describeChanges(c: RoutineChanges): string[] {
  return [
    ...c.added.map((a) => `Add ${a.name}, ${setsText(a.sets)}`),
    ...c.removed.map((r) => `Remove ${r.name}`),
    ...c.sets.map((s) => `${s.name}: ${s.from} → ${setsText(s.to)}`),
    ...(c.reordered ? ['New exercise order'] : []),
  ]
}

/**
 * The routine with the workout's exercises. Name, notes and folder stay; an
 * exercise the routine already had keeps its rest time (changing it mid-workout
 * is usually for that day only), a new one takes the rest it had in the workout.
 */
export function routineInputFrom(routine: Routine, done: DoneExercise[]): RoutineInput {
  const planned = routine.routine_exercises
  const plannedKeys = occurrenceKeys(planned.map((re) => re.exercise_id))
  const restByKey = new Map(plannedKeys.map((k, i) => [k, planned[i].rest_seconds]))
  const doneKeys = occurrenceKeys(done.map((e) => e.exerciseId))
  return {
    id: routine.id,
    name: routine.name,
    notes: routine.notes,
    folder_id: routine.folder_id,
    exercises: done.map((e, i) => ({
      exercise_id: e.exerciseId,
      target_sets: e.sets,
      rest_seconds: restByKey.get(doneKeys[i]) ?? e.restSeconds,
    })),
  }
}
