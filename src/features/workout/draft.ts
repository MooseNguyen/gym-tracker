// The workout in progress lives only on the device until "Finish".
// Everything here is pure so it can be unit tested; the store is in draftStore.ts.
import type { Exercise, ExerciseKind, PreviousSet, SetType, Workout } from '../../types/db'
import { reorder } from '../../shared/reorder'

/** What a draft needs to know about an exercise. Tests can omit the image. */
export type ExerciseRef = Pick<Exercise, 'id' | 'name' | 'kind'> & {
  image_path?: string | null
  user_id?: string | null
}

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
  /** Optional: drafts saved before images existed do not have it. */
  imagePath?: string | null
  /** User-created exercise: has no built-in instructions. Missing in old drafts = built-in. */
  custom?: boolean
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
  exercise: ExerciseRef,
  sets = 1,
  restSeconds = DEFAULT_REST,
): DraftExercise {
  return {
    id: uid(),
    exerciseId: exercise.id,
    name: exercise.name,
    kind: exercise.kind,
    imagePath: exercise.image_path ?? null,
    custom: !!exercise.user_id,
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
      exercise: ExerciseRef
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
      imagePath: we.exercise.image_path,
      custom: !!we.exercise.user_id,
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

export function addExercises(d: WorkoutDraft, exercises: ExerciseRef[]): WorkoutDraft {
  return { ...d, exercises: [...d.exercises, ...exercises.map((e) => draftExercise(e))] }
}

export function removeExercise(d: WorkoutDraft, exId: string): WorkoutDraft {
  return { ...d, exercises: d.exercises.filter((e) => e.id !== exId) }
}

export function reorderExercises(d: WorkoutDraft, fromId: string, toId: string): WorkoutDraft {
  return { ...d, exercises: reorder(d.exercises, fromId, toId) }
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

/** The value a set cannot be logged without: reps, or seconds for timed exercises. */
export function requiredField(kind: ExerciseKind): 'reps' | 'duration' {
  return kind === 'duration' ? 'duration' : 'reps'
}

/** A set is loggable only with a positive rep count (or duration). Weight is optional. */
export function hasRequiredValue(kind: ExerciseKind, set: DraftSet): boolean {
  const n = parseNumber(set[requiredField(kind)])
  return n != null && n > 0
}

/**
 * Ticks a set on or off. Completing a set fills empty fields from last time
 * (tap ✓ to "repeat what I did last week") and starts the rest timer.
 *
 * Refuses to complete a set that still has no reps (or duration) after that
 * fill and returns the draft unchanged: an empty ticked set used to be saved
 * and then shown as "BW × 0" in Previous. The caller detects the refusal
 * (the set is still not completed) and points the user at the empty field.
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
  const filled: DraftSet = {
    ...set,
    completed: true,
    weight: set.weight || str(previous?.weight_kg),
    reps: set.reps || str(previous?.reps),
    duration: set.duration || str(previous?.duration_s),
  }
  if (!hasRequiredValue(ex.kind, filled)) return d

  const next = updateSet(d, exId, setId, filled)
  return { ...next, restEndsAt: ex.restSeconds > 0 ? now + ex.restSeconds * 1000 : null }
}

export interface Improvement {
  kg: number
  reps: number
  seconds: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * How a completed set beats the set at the same position last time, or null if
 * it does not. "Beats" = more kg OR more reps (OR more seconds for timed sets),
 * as asked: fewer reps at a heavier weight still counts as progress.
 * Warm-ups never count, and without a previous set there is nothing to beat.
 */
export function improvementOver(set: DraftSet, prev: PreviousSet | undefined): Improvement | null {
  if (!prev || set.setType === 'warmup' || prev.set_type === 'warmup') return null
  const gain = (now: number | null, before: number | null) =>
    now != null && before != null ? Math.max(0, round2(now - before)) : 0

  // Missing weight means bodyweight only, i.e. 0 kg added: going from BW to +5 kg is progress.
  const kg = gain(parseNumber(set.weight) ?? 0, prev.weight_kg ?? 0)
  const reps = gain(parseNumber(set.reps), prev.reps)
  const seconds = gain(parseNumber(set.duration), prev.duration_s)
  return kg > 0 || reps > 0 || seconds > 0 ? { kg, reps, seconds } : null
}

export function describeImprovement(i: Improvement): string {
  const parts = [
    i.kg > 0 && `+${i.kg} kg`,
    i.reps > 0 && `+${i.reps} rep${i.reps === 1 ? '' : 's'}`,
    i.seconds > 0 && `+${i.seconds}s`,
  ].filter(Boolean)
  return parts.join(' · ')
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
          // Second check: a draft saved before ticking was validated (or edited
          // afterwards) can still hold a ticked set with no reps. Never save it.
          .filter((s) => s.completed && hasRequiredValue(e.kind, s))
          .map((s) => ({
            set_type: s.setType,
            // Every kind can carry weight: a weighted pull-up, a plate on a plank.
            // For bodyweight exercises it is the added weight; empty = bodyweight only.
            weight_kg: parseNumber(s.weight),
            reps: e.kind === 'duration' ? null : int(s.reps),
            duration_s: e.kind === 'duration' ? int(s.duration) : null,
            rpe: rpe(s.rpe),
          })),
      }))
      .filter((e) => e.sets.length > 0),
  }
}
