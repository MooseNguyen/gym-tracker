/** Plates usually found in a gym, heaviest first (kg). */
export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const
/** Bars to pick from: Olympic men's, women's / technique, and a short or EZ bar. */
export const KG_BARS = [20, 15, 10] as const

export interface PlateLoad {
  /** Plates for ONE side of the bar, heaviest first (the order they go on). */
  perSide: number[]
  /** Total weight that can be left over when the plates can't make it exactly. */
  leftOver: number
  /** The target is lighter than the empty bar. */
  belowBar: boolean
}

/**
 * Plates per side for a total bar weight, taking the heaviest plate that
 * still fits each time (with standard plate sets that is also the fewest
 * plates). Done in hundredths of a unit, so 2.5 and 1.25 never pick up
 * floating-point errors like 0.30000000000000004.
 */
export function platesPerSide(
  total: number,
  bar: number,
  plates: readonly number[] = KG_PLATES,
): PlateLoad {
  const cents = (n: number) => Math.round(n * 100)
  if (cents(total) < cents(bar)) return { perSide: [], leftOver: 0, belowBar: true }

  let side = Math.floor((cents(total) - cents(bar)) / 2)
  const perSide: number[] = []
  for (const plate of plates) {
    const p = cents(plate)
    while (side >= p) {
      perSide.push(plate)
      side -= p
    }
  }
  // Left over for the whole bar: what one side is short, twice, plus the odd
  // hundredth an uneven total cannot split.
  const loaded = cents(bar) + 2 * perSide.reduce((n, p) => n + cents(p), 0)
  return { perSide, leftOver: (cents(total) - loaded) / 100, belowBar: false }
}
