// Body weight log: pure helpers (ranges, change over a range, input checks,
// CSV). Weights are kg here, like in the database; screens convert.
import { csvField } from '../settings/csv'
import { dayKey } from '../home/calendar'
import { parseNumber } from '../workout/draft'
import { fromKg, toKg, type Unit } from '../../shared/units'

export interface BodyWeight {
  /** The phone's local date, "YYYY-MM-DD". One weigh-in per day. */
  measured_on: string
  weight_kg: number
}

export type Range = '3m' | '1y' | 'all'

export const RANGES: { value: Range; label: string; months: number | null }[] = [
  { value: '3m', label: '3 months', months: 3 },
  { value: '1y', label: '1 year', months: 12 },
  { value: 'all', label: 'All', months: null },
]

/** Same bounds as the database check (body_weights migration). */
export const MIN_KG = 20
export const MAX_KG = 400

/** "YYYY-MM-DD" as a local date (new Date("2026-11-01") would be UTC midnight). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Entries from `range` back to today, oldest first. Expects them sorted by day. */
export function inRange(entries: BodyWeight[], range: Range, today: Date): BodyWeight[] {
  const months = RANGES.find((r) => r.value === range)?.months
  if (months == null) return entries
  const from = new Date(today.getFullYear(), today.getMonth() - months, today.getDate())
  const fromKey = dayKey(from)
  return entries.filter((e) => e.measured_on >= fromKey)
}

/** First to last weigh-in of the entries, in kg; null with fewer than two. */
export function change(entries: BodyWeight[]): number | null {
  if (entries.length < 2) return null
  return Math.round((entries.at(-1)!.weight_kg - entries[0].weight_kg) * 100) / 100
}

export type WeighInCheck =
  | { ok: true; weight_kg: number; measured_on: string }
  | { ok: false; field: 'weight' | 'date'; message: string }

/** Checks a typed weigh-in and converts it to kg. `today` is the phone's local day. */
export function checkWeighIn(weight: string, day: string, unit: Unit, today: string): WeighInCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, field: 'date', message: 'Pick a day.' }
  if (day > today) return { ok: false, field: 'date', message: 'That day has not happened yet.' }
  const value = parseNumber(weight)
  // Whole numbers inside the database's bounds, so the message says exactly what passes.
  const min = Math.ceil(fromKg(MIN_KG, unit))
  const max = Math.floor(fromKg(MAX_KG, unit))
  if (value == null || value < min || value > max)
    return {
      ok: false,
      field: 'weight',
      message: `Enter a weight between ${min} and ${max} ${unit}.`,
    }
  // Exactly representable in numeric(5, 2), and within the database's bounds.
  const kg = Math.min(MAX_KG, Math.max(MIN_KG, Math.round(toKg(value, unit) * 100) / 100))
  return { ok: true, weight_kg: kg, measured_on: day }
}

/** Byte order mark: Excel then reads the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff)

/** One row per weigh-in, oldest first, in the account's unit. Same format as workoutsToCsv. */
export function bodyWeightsToCsv(entries: BodyWeight[], unit: Unit): string {
  const rows = [
    ['Date', `Weight (${unit})`],
    ...[...entries]
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
      .map((e) => [e.measured_on, fromKg(e.weight_kg, unit)]),
  ]
  return BOM + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}
