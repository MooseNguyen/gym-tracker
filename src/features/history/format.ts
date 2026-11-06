import type { ExerciseKind, SetRow } from '../../types/db'

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000)
}

export function formatSet(kind: ExerciseKind, s: SetRow): string {
  const prefix = s.set_type === 'normal' ? '' : `${s.set_type[0].toUpperCase()} · `
  const rpe = s.rpe != null ? ` @${s.rpe}` : ''
  if (kind === 'duration') return `${prefix}${s.duration_s ?? 0}s`
  if (kind === 'bodyweight_reps') return `${prefix}${s.reps ?? 0} reps${rpe}`
  return `${prefix}${s.weight_kg ?? 0} kg × ${s.reps ?? 0}${rpe}`
}
