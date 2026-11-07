// Weights are stored in kg everywhere (database, API payloads). The unit the
// account picked only changes what is shown and typed, converted here.

export type Unit = 'kg' | 'lb'

export const LB_PER_KG = 2.20462262

/** kg → the display unit. lb is rounded to 0.1 lb. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : Math.round(kg * LB_PER_KG * 10) / 10
}

/** Steps a kg weight is usually a multiple of, coarsest first; 0.01 is what the database keeps. */
const KG_GRIDS = [1, 0.5, 0.25, 0.05, 0.01]

/**
 * Display unit → kg for saving. For lb, the coarsest kg value that shows as
 * the same lb again. A set logged as 100 kg shows as 220.5 lb; saving it back
 * from an lb screen must store 100, not 100.02 (220.5 / 2.2046), or the
 * database would see a heavier lift and mark a false PR. The 0.01 grid
 * always round-trips (0.01 kg ≈ 0.02 lb < the 0.05 lb rounding), so there
 * is always an answer.
 */
export function toKg(value: number, unit: Unit): number {
  if (unit === 'kg') return value
  const exact = value / LB_PER_KG
  for (const grid of KG_GRIDS) {
    // Integer steps (× 100) so 0.05 × n never picks up float noise.
    const steps = Math.round(grid * 100)
    const kg = (Math.round((exact * 100) / steps) * steps) / 100
    if (fromKg(kg, 'lb') === value) return kg
  }
  return Math.round(exact * 100) / 100
}

export function fromKgOrNull(kg: number | null, unit: Unit): number | null {
  return kg == null ? null : fromKg(kg, unit)
}

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** "3,240 kg" / "1,120 lb" for an amount already in `unit`: volumes get large, the separator keeps them readable. */
export const formatAmount = (value: number, unit: Unit) => `${numberFmt.format(value)} ${unit}`

/** Typo guard for a typed weight, per unit: anything above is an extra 0, not a lift. */
export const MAX_WEIGHT: Record<Unit, number> = { kg: 1000, lb: 2200 }
