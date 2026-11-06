import type { ExerciseKind, SetType } from '../../types/db'

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
/** "3,240 kg": volumes get large, the separator keeps them readable. */
export const formatKg = (kg: number) => `${numberFmt.format(kg)} kg`

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

/**
 * One formatter for a set everywhere (history, "Previous" column):
 * "80 kg × 8", "BW × 12" (bodyweight, nothing added), "10 kg × 6" (weighted pull-up),
 * "60s" or "10 kg · 60s" for timed sets.
 */
export function formatSetValues(kind: ExerciseKind, s: SetValues): string {
  const kg = s.weight_kg && s.weight_kg > 0 ? `${s.weight_kg} kg` : null
  if (kind === 'duration') {
    const time = `${s.duration_s ?? 0}s`
    return kg ? `${kg} · ${time}` : time
  }
  const load = kg ?? (kind === 'bodyweight_reps' ? 'BW' : '0 kg')
  return `${load} × ${s.reps ?? 0}`
}

export function formatSet(kind: ExerciseKind, s: SetValues): string {
  const prefix = !s.set_type || s.set_type === 'normal' ? '' : `${s.set_type[0].toUpperCase()} · `
  const rpe = s.rpe != null ? ` @${s.rpe}` : ''
  return `${prefix}${formatSetValues(kind, s)}${rpe}`
}
