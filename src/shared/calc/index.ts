import type { SetType } from '../../types/db'

export interface CalcSet {
  set_type: SetType
  weight_kg: number | null
  reps: number | null
}

/** Warm-up sets never count towards volume or personal records. */
function isWorkingSet(s: CalcSet): boolean {
  return s.set_type !== 'warmup'
}

/**
 * Estimated one-rep max using the Epley formula.
 * Returns null when there is nothing meaningful to estimate.
 * Above ~12 reps the estimate gets unreliable, but it is still useful as a trend.
 */
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return null
  if (reps === 1) return weightKg
  return round1(weightKg * (1 + reps / 30))
}

/** Total weight moved (weight x reps) across working sets. */
export function totalVolume(sets: CalcSet[]): number {
  return round1(
    sets.filter(isWorkingSet).reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
  )
}

export interface SessionSummary {
  date: string
  bestE1RM: number | null
  heaviestKg: number | null
  bestReps: number | null
  volume: number
}

/** Collapses one session's sets for one exercise into chart-friendly numbers. */
export function summarizeSession(date: string, sets: CalcSet[]): SessionSummary {
  const working = sets.filter(isWorkingSet)
  return {
    date,
    bestE1RM: maxOrNull(working.map((s) => estimate1RM(s.weight_kg, s.reps))),
    heaviestKg: maxOrNull(working.map((s) => (s.reps ? s.weight_kg : null))),
    bestReps: maxOrNull(working.map((s) => s.reps)),
    volume: totalVolume(working),
  }
}

export interface PersonalRecords {
  bestE1RM: { value: number; date: string } | null
  heaviestKg: { value: number; date: string } | null
  bestSessionVolume: { value: number; date: string } | null
  bestReps: { value: number; date: string } | null
}

/** Best values across all sessions. Earliest date wins a tie: that is when the PR was set. */
export function personalRecords(sessions: SessionSummary[]): PersonalRecords {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const best = (pick: (s: SessionSummary) => number | null) => {
    let result: { value: number; date: string } | null = null
    for (const s of sorted) {
      const v = pick(s)
      if (v != null && v > 0 && (result == null || v > result.value)) {
        result = { value: v, date: s.date }
      }
    }
    return result
  }
  return {
    bestE1RM: best((s) => s.bestE1RM),
    heaviestKg: best((s) => s.heaviestKg),
    bestSessionVolume: best((s) => s.volume),
    bestReps: best((s) => s.bestReps),
  }
}

function maxOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null)
  return nums.length ? Math.max(...nums) : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
