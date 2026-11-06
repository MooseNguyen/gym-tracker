import type { Routine, Workout } from '../../types/db'
import { draftFromWorkout, newDraft, type WorkoutDraft } from './draft'
import { setDraft } from './draftStore'

/**
 * Only one draft can exist. Returns false if the user chose to keep the current one.
 */
function replaceDraft(current: WorkoutDraft | null, next: WorkoutDraft): boolean {
  if (
    current &&
    !confirm(`You have an unfinished workout "${current.name}". Discard it and start this one?`)
  ) {
    return false
  }
  setDraft(next)
  return true
}

export function startEmptyWorkout(current: WorkoutDraft | null) {
  return replaceDraft(current, newDraft({ name: 'Workout' }))
}

export function startRoutine(current: WorkoutDraft | null, r: Routine) {
  return replaceDraft(
    current,
    newDraft({
      name: r.name,
      routineId: r.id,
      exercises: r.routine_exercises.map((re) => ({
        exercise: re.exercise,
        sets: re.target_sets,
        restSeconds: re.rest_seconds,
      })),
    }),
  )
}

export function editWorkout(current: WorkoutDraft | null, w: Workout) {
  return replaceDraft(current, draftFromWorkout(w))
}
