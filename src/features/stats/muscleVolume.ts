import { MUSCLE_GROUPS, MUSCLE_SUBGROUPS, type Workout } from '../../types/db'
import { startOfWeek } from '../home/calendar'
import { setsPerMuscle } from '../history/summary'

/**
 * Weekly working sets per muscle group, the usual hypertrophy guideline is
 * roughly 10–20 hard sets per muscle group per week. A reference, not a rule.
 */
export const WEEKLY_TARGET = { min: 10, max: 20 } as const

export type VolumeStatus = 'none' | 'low' | 'ok' | 'high'

export function volumeStatus(sets: number): VolumeStatus {
  if (sets === 0) return 'none'
  if (sets < WEEKLY_TARGET.min) return 'low'
  if (sets > WEEKLY_TARGET.max) return 'high'
  return 'ok'
}

/** Groups measured in sets: everything except cardio. */
export const SET_GROUPS = MUSCLE_GROUPS.filter((g) => g !== 'cardio')

export interface GroupVolume {
  group: string
  sets: number
  status: VolumeStatus
  /** Sets per target, for groups split into sub-muscles; the plain group value ("general") last. */
  muscles: { muscle: string; sets: number }[]
}

/**
 * Working sets per group over the given workouts, in the app's group order.
 * Every set-based group is listed, untrained ones with 0, so gaps show.
 * Primary and secondary muscles both count (see setsPerMuscle).
 */
export function groupVolumes(workouts: Workout[]): GroupVolume[] {
  const byMuscle = new Map<string, number>()
  for (const w of workouts) {
    for (const m of setsPerMuscle(w, { secondary: true }))
      byMuscle.set(m.muscle, (byMuscle.get(m.muscle) ?? 0) + m.sets)
  }
  return SET_GROUPS.map((group) => {
    const subs = MUSCLE_SUBGROUPS[group] ?? []
    const muscles = [...subs, group]
      .map((muscle) => ({ muscle, sets: byMuscle.get(muscle) ?? 0 }))
      .filter((m) => subs.length > 0 && (m.muscle !== group || m.sets > 0))
    const sets = [...subs, group].reduce((n, m) => n + (byMuscle.get(m) ?? 0), 0)
    return { group, sets, status: volumeStatus(sets), muscles }
  })
}

/** Monday 00:00 to next Monday 00:00 (local), `offset` weeks from the week of `today`. */
export function weekRange(today: Date, offset = 0): { from: Date; to: Date } {
  const from = startOfWeek(today)
  from.setDate(from.getDate() + 7 * offset)
  const to = new Date(from)
  to.setDate(from.getDate() + 7) // setDate, not +7×24h: a DST week is 167 or 169 hours
  return { from, to }
}
