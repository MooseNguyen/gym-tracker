import type { ExerciseKind, SetType } from '../../types/db'
import { fromKgOrNull, type Unit } from '../../shared/units'

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000)
}

interface SetValues {
  set_type?: SetType
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  rpe?: number | null
}

/** A set's numbers with the weight already in the display unit (the workout screen types in it). */
export interface SetInUnit {
  weight: number | null
  reps: number | null
  duration_s: number | null
}

/**
 * One formatter for a set everywhere (history, "Previous" column):
 * "80 kg × 8", "BW × 12" (bodyweight, nothing added), "10 kg × 6" (weighted pull-up),
 * "60s" or "10 kg · 60s" for timed sets. The weight comes in kg and is shown in `unit`.
 */
export function formatSetValues(kind: ExerciseKind, s: SetValues, unit: Unit): string {
  return formatSetIn(kind, { ...s, weight: fromKgOrNull(s.weight_kg, unit) }, unit)
}

/** formatSetValues for a weight that is already in `unit`. */
export function formatSetIn(kind: ExerciseKind, s: SetInUnit, unit: Unit): string {
  const load = s.weight && s.weight > 0 ? `${s.weight} ${unit}` : null
  if (kind === 'duration') {
    const time = `${s.duration_s ?? 0}s`
    return load ? `${load} · ${time}` : time
  }
  return `${load ?? (kind === 'bodyweight_reps' ? 'BW' : `0 ${unit}`)} × ${s.reps ?? 0}`
}

export function formatSet(kind: ExerciseKind, s: SetValues, unit: Unit): string {
  const prefix = !s.set_type || s.set_type === 'normal' ? '' : `${s.set_type[0].toUpperCase()} · `
  const rpe = s.rpe != null ? ` @${s.rpe}` : ''
  return `${prefix}${formatSetValues(kind, s, unit)}${rpe}`
}
