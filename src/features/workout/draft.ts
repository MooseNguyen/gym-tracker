// The workout in progress lives only on the device until "Finish".
// Everything here is pure so it can be unit tested; the store is in draftStore.ts.
import type { Exercise, ExerciseKind, PreviousSet, SetType, Workout } from '../../types/db'

export interface DraftSet {
  id: string
  setType: SetType
  // Inputs are kept as strings: parsing on every keystroke would turn "62." into 62
  // and make it impossible to type a decimal.
  weight: string
  reps: string
  duration: string
  rpe: string
  completed: boolean
}

export interface DraftExercise {
  id: string
  exerciseId: string
  name: string
  kind: ExerciseKind
  restSeconds: number
  notes: string
  sets: DraftSet[]
}

export interface WorkoutDraft {
  id: string
  mode: 'new' | 'edit'
  routineId: string | null
  name: string
  notes: string
  startedAt: string
  /** Only set when editing a saved workout, so its duration is preserved. */
  endedAt: string | null
  exercises: DraftExercise[]
  /** Epoch ms. A timestamp, not a counter: it stays correct after the app is backgrounded. */
  restEndsAt: number | null
}

const DEFAULT_REST = 90
const uid = () => crypto.randomUUID()

export function emptySet(from?: DraftSet): DraftSet {
  return {
    id: uid(),
    setType: from?.setType === 'warmup' ? 'warmup' : 'normal',
    weight: from?.weight ?? '',
    reps: from?.reps ?? '',
    duration: from?.duration ?? '',
    rpe: '',
    completed: false,
  }
}

export function draftExercise(
  exercise: Pick<Exercise, 'id' | 'name' | 'kind'>,
  sets = 1,
  restSeconds = DEFAULT_REST,
): DraftExercise {
  return {
    id: uid(),
    exerciseId: exercise.id,
    name: exercise.name,
    kind: exercise.kind,
    restSeconds,
    notes: '',
    sets: Array.from({ length: Math.max(1, sets) }, () => emptySet()),
  }
}

export function newDraft(
  input: {
    name: string
    routineId?: string | null
    exercises?: {
      exercise: Pick<Exercise, 'id' | 'name' | 'kind'>
      sets: number
      restSeconds: number
    }[]
  },
  now = new Date(),
): WorkoutDraft {
  return {
    id: uid(),
    mode: 'new',
    routineId: input.routineId ?? null,
    name: input.name,
    notes: '',
    startedAt: now.toISOString(),
    endedAt: null,
    exercises: (input.exercises ?? []).map((e) => draftExercise(e.exercise, e.sets, e.restSeconds)),
    restEndsAt: null,
  }
}

/** Loads a saved workout back into the editor. All its sets were completed when saved. */
export function draftFromWorkout(w: Workout): WorkoutDraft {
  const str = (n: number | null) => (n == null ? '' : String(n))
  return {
    id: w.id,
    mode: 'edit',
    routineId: w.routine_id,
    name: w.name,
    notes: w.notes ?? '',
    startedAt: w.started_at,
    endedAt: w.ended_at,
    restEndsAt: null,
    exercises: w.workout_exercises.map((we) => ({
      id: uid(),
      exerciseId: we.exercise_id,
      name: we.exercise.name,
      kind: we.exercise.kind,
      restSeconds: DEFAULT_REST,
      notes: we.notes ?? '',
      sets: we.sets.map((s) => ({
        id: uid(),
        setType: s.set_type,
        weight: str(s.weight_kg),
        reps: str(s.reps),
        duration: str(s.duration_s),
        rpe: str(s.rpe),
        completed: true,
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Updates. Each returns a new draft (immutable), so React re-renders correctly.
// ---------------------------------------------------------------------------

function mapExercise(
  d: WorkoutDraft,
  exId: string,
  fn: (e: DraftExercise) => DraftExercise,
): WorkoutDraft {
  return { ...d, exercises: d.exercises.map((e) => (e.id === exId ? fn(e) : e)) }
}

export function addExercises(
  d: WorkoutDraft,
  exercises: Pick<Exercise, 'id' | 'name' | 'kind'>[],
): WorkoutDraft {
  return { ...d, exercises: [...d.exercises, ...exercises.map((e) => draftExercise(e))] }
}

export function removeExercise(d: WorkoutDraft, exId: string): WorkoutDraft {
  return { ...d, exercises: d.exercises.filter((e) => e.id !== exId) }
}

export function moveExercise(d: WorkoutDraft, exId: string, dir: -1 | 1): WorkoutDraft {
  const i = d.exercises.findIndex((e) => e.id === exId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= d.exercises.length) return d
  const exercises = [...d.exercises]
  ;[exercises[i], exercises[j]] = [exercises[j], exercises[i]]
  return { ...d, exercises }
}

/** New set copies the previous set's numbers: you usually repeat the same weight. */
export function addSet(d: WorkoutDraft, exId: string): WorkoutDraft {
  return mapExercise(d, exId, (e) => ({ ...e, sets: [...e.sets, emptySet(e.sets.at(-1))] }))
}

export function removeSet(d: WorkoutDraft, exId: string, setId: string): WorkoutDraft {
  return mapExercise(d, exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }))
}

export function updateSet(
  d: WorkoutDraft,
  exId: string,
  setId: string,
  patch: Partial<DraftSet>,
): WorkoutDraft {
  return mapExercise(d, exId, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }))
}

export function updateExercise(
  d: WorkoutDraft,
  exId: string,
  patch: Partial<Pick<DraftExercise, 'notes' | 'restSeconds'>>,
): WorkoutDraft {
  return mapExercise(d, exId, (e) => ({ ...e, ...patch }))
}

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure']
export function nextSetType(t: SetType): SetType {
  return SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(t) + 1) % SET_TYPE_CYCLE.length]
}

/**
 * Ticks a set on or off. Completing a set fills empty fields from last time
 * (tap ✓ to "repeat what I did last week") and starts the rest timer.
 */
export function toggleSetComplete(
  d: WorkoutDraft,
  exId: string,
  setId: string,
  previous: PreviousSet | undefined,
  now = Date.now(),
): WorkoutDraft {
  const ex = d.exercises.find((e) => e.id === exId)
  const set = ex?.sets.find((s) => s.id === setId)
  if (!ex || !set) return d

  if (set.completed) return updateSet(d, exId, setId, { completed: false })

  const str = (n: number | null | undefined) => (n == null ? '' : String(n))
  const next = updateSet(d, exId, setId, {
    completed: true,
    weight: set.weight || str(previous?.weight_kg),
    reps: set.reps || str(previous?.reps),
    duration: set.duration || str(previous?.duration_s),
  })
  return { ...next, restEndsAt: ex.restSeconds > 0 ? now + ex.restSeconds * 1000 : null }
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** Accepts "62,5" too: the iOS decimal keypad shows a comma in many locales (vi-VN included). */
export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export interface SaveWorkoutPayload {
  id: string
  routine_id: string | null
  name: string
  notes: string | null
  started_at: string
  ended_at: string
  exercises: {
    exercise_id: string
    notes: string | null
    sets: {
      set_type: SetType
      weight_kg: number | null
      reps: number | null
      duration_s: number | null
      rpe: number | null
    }[]
  }[]
}

export function completedSetCount(d: WorkoutDraft): number {
  return d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0)
}

/** Only completed sets are saved; exercises left with no completed sets are dropped. */
export function toSavePayload(d: WorkoutDraft, now = new Date()): SaveWorkoutPayload {
  const rpe = (v: string) => {
    const n = parseNumber(v)
    return n != null && n >= 1 && n <= 10 ? n : null
  }
  const int = (v: string) => {
    const n = parseNumber(v)
    return n == null ? null : Math.round(n)
  }
  return {
    id: d.id,
    routine_id: d.routineId,
    name: d.name.trim() || 'Workout',
    notes: d.notes.trim() || null,
    started_at: d.startedAt,
    ended_at: d.endedAt ?? now.toISOString(),
    exercises: d.exercises
      .map((e) => ({
        exercise_id: e.exerciseId,
        notes: e.notes.trim() || null,
        sets: e.sets
          .filter((s) => s.completed)
          .map((s) => ({
            set_type: s.setType,
            weight_kg: e.kind === 'weight_reps' ? parseNumber(s.weight) : null,
            reps: e.kind === 'duration' ? null : int(s.reps),
            duration_s: e.kind === 'duration' ? int(s.duration) : null,
            rpe: rpe(s.rpe),
          })),
      }))
      .filter((e) => e.sets.length > 0),
  }
}
