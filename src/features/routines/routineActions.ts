import type { Routine } from '../../types/db'
import type { RoutineInput } from './api'

/**
 * Name for a copy that does not clash with the given names:
 * "Push" → "Push (copy)" → "Push (copy 2)"… Copying a copy keeps one suffix.
 */
export function duplicateName(name: string, taken: string[]): string {
  const base = name.replace(/ \(copy(?: \d+)?\)$/, '')
  const names = new Set(taken)
  if (!names.has(`${base} (copy)`)) return `${base} (copy)`
  let n = 2
  while (names.has(`${base} (copy ${n})`)) n++
  return `${base} (copy ${n})`
}

/** save_routine payload for a copy: same folder, exercises, sets and rest; no id. */
export function duplicatePayload(routine: Routine, name: string): RoutineInput {
  return {
    name,
    notes: routine.notes,
    folder_id: routine.folder_id,
    exercises: routine.routine_exercises.map((re) => ({
      exercise_id: re.exercise_id,
      target_sets: re.target_sets,
      rest_seconds: re.rest_seconds,
    })),
  }
}

/** Plain text for the share sheet / clipboard. */
export function routineShareText(routine: Routine): string {
  const lines = routine.routine_exercises.map(
    (re, i) =>
      `${i + 1}. ${re.exercise.name} — ${re.target_sets} ${re.target_sets === 1 ? 'set' : 'sets'}`,
  )
  return [routine.name, ...(routine.notes ? [routine.notes] : []), '', ...lines].join('\n')
}
