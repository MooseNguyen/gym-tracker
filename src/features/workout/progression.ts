import type { ExerciseKind, PreviousSet } from '../../types/db'
import { fromKgOrNull, type Unit } from '../../shared/units'

/** Double progression: add reps up to the top of the range, then add load and restart at the bottom. */
export const REP_RANGE = { min: 8, max: 12 } as const
const SECONDS_STEP = 5

/**
 * Smallest sensible load step per equipment, in the unit the lifter loads in:
 * lb gyms jump 5 lb on a bar (2 × 2.5 lb plates), not 2.5 kg = 5.5 lb.
 * Null: progress with reps only.
 */
export function loadStep(equipment: string | undefined, unit: Unit): number | null {
  switch (equipment) {
    case 'dumbbell':
      return unit === 'kg' ? 2 : 5
    case 'kettlebell':
      return unit === 'kg' ? 4 : 10
    case 'bodyweight':
    case 'band':
      return null
    default:
      // barbell, machine, cable, other — and old drafts that don't know.
      return unit === 'kg' ? 2.5 : 5
  }
}

export type SuggestionReason =
  'rpe-easy' | 'rpe-hard' | 'rpe-max' | 'top-of-range' | 'next-rep' | 'hold'

export interface SetSuggestion {
  /** In the display unit (what the lifter types), not kg. */
  weight: number | null
  reps: number | null
  duration: number | null
  reason: SuggestionReason
  /** RPE of last time's set, when the reason came from it. */
  rpe?: number
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Next target for one set, from the same set last time.
 * With RPE: ≤7 → more load, 8–9 → one more rep, ≥9.5 or a failure set → repeat.
 * Without RPE: double progression in an 8–12 rep range.
 * Warm-ups are repeated as they were. Returns null when there is nothing to build on.
 * `prev` comes from the database (kg); the suggestion is in `unit`.
 */
export function suggestSet(
  kind: ExerciseKind,
  equipment: string | undefined,
  prev: PreviousSet | undefined,
  unit: Unit,
): SetSuggestion | null {
  if (!prev) return null
  const weight = fromKgOrNull(prev.weight_kg, unit)
  const same = { weight, reps: prev.reps, duration: prev.duration_s }

  if (prev.set_type === 'warmup') return { ...same, reason: 'hold' }

  if (kind === 'duration') {
    if (!prev.duration_s) return null
    return { ...same, duration: prev.duration_s + SECONDS_STEP, reason: 'next-rep' }
  }

  if (!prev.reps) return null
  const step = kind === 'weight_reps' ? loadStep(equipment, unit) : null
  const canLoad = step != null && weight != null && weight > 0
  const moreLoad = (reps: number, reason: SuggestionReason, rpe?: number): SetSuggestion => ({
    weight: round(weight! + step!),
    reps,
    duration: null,
    reason,
    rpe,
  })
  const oneMoreRep = (reason: SuggestionReason, rpe?: number): SetSuggestion => ({
    ...same,
    reps: prev.reps! + 1,
    reason,
    rpe,
  })

  if (prev.set_type === 'failure') return { ...same, reason: 'hold' }

  if (prev.rpe != null) {
    if (prev.rpe >= 9.5) return { ...same, reason: 'rpe-max', rpe: prev.rpe }
    if (prev.rpe <= 7) {
      return canLoad ? moreLoad(prev.reps, 'rpe-easy', prev.rpe) : oneMoreRep('rpe-easy', prev.rpe)
    }
    return oneMoreRep('rpe-hard', prev.rpe)
  }

  if (prev.reps >= REP_RANGE.max && canLoad) return moreLoad(REP_RANGE.min, 'top-of-range')
  return oneMoreRep('next-rep')
}

/** Suggestions for each set position, from last time's sets in the same order. */
export function suggestSets(
  kind: ExerciseKind,
  equipment: string | undefined,
  previous: PreviousSet[],
  unit: Unit,
): (SetSuggestion | null)[] {
  return previous.map((p) => suggestSet(kind, equipment, p, unit))
}

/** The suggestion to headline for an exercise: the first working set's. */
export function headlineSuggestion(
  previous: PreviousSet[],
  suggestions: (SetSuggestion | null)[],
): SetSuggestion | null {
  const i = previous.findIndex((p) => p.set_type !== 'warmup')
  return i >= 0 ? suggestions[i] : null
}

export function describeReason(s: SetSuggestion): string {
  switch (s.reason) {
    case 'rpe-easy':
      return `RPE ${s.rpe} last time`
    case 'rpe-hard':
      return `RPE ${s.rpe} last time: one more rep`
    case 'rpe-max':
      return `RPE ${s.rpe} last time: repeat it`
    case 'top-of-range':
      return `hit ${REP_RANGE.max} reps last time`
    case 'next-rep':
      return 'one more than last time'
    case 'hold':
      return 'same as last time'
  }
}
