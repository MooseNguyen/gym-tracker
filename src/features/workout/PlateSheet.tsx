import { useId, useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { parseNumber } from './draft'
import type { Unit } from '../../shared/units'
import { GYM, platesPerSide } from './plates'

type PlateStyle = Record<number, { color: string; height: number }>

/** Competition (IWF) plate colours, so the drawing matches the plates in the rack. */
const KG_STYLE: PlateStyle = {
  25: { color: '#d64545', height: 100 },
  20: { color: '#3b6fd6', height: 100 },
  15: { color: '#e0b93a', height: 92 },
  10: { color: '#3f9e5a', height: 82 },
  5: { color: '#e8e8e8', height: 64 },
  2.5: { color: '#d64545', height: 52 },
  1.25: { color: '#b9bec4', height: 44 },
}

/** lb plates have no colour standard: the nearest kg plate's colour, sized by weight. */
const LB_STYLE: PlateStyle = {
  45: KG_STYLE[20],
  35: KG_STYLE[15],
  25: KG_STYLE[10],
  10: KG_STYLE[5],
  5: KG_STYLE[2.5],
  2.5: KG_STYLE[1.25],
}

const PLATE_STYLE: Record<Unit, PlateStyle> = { kg: KG_STYLE, lb: LB_STYLE }

const fmt = (n: number) => String(n).replace(/\.0+$/, '')

/**
 * "What goes on the bar?" for a target weight: plates per side, drawn on a
 * bar, with what can't be made exactly. Opens on the weight of the next set.
 */
export function PlateSheet({
  open,
  initialWeight,
  unit,
  onClose,
}: {
  open: boolean
  /** In `unit`, like the set it comes from. */
  initialWeight: number | null
  unit: Unit
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Plate calculator">
      {/* Remounted on every open, so it starts from the current set's weight. */}
      {open && <PlateCalculator initialWeight={initialWeight} unit={unit} />}
    </Dialog>
  )
}

function PlateCalculator({ initialWeight, unit }: { initialWeight: number | null; unit: Unit }) {
  const gym = GYM[unit]
  const [bar, setBar] = useState<number>(gym.bars[0])
  const [input, setInput] = useState(initialWeight ? fmt(initialWeight) : '')
  const weightId = useId()
  const total = parseNumber(input)
  const load = total != null && total > 0 ? platesPerSide(total, bar, gym.plates) : null

  return (
    <div className="stack plate-calc">
      <div className="row">
        <label className="field" htmlFor={weightId}>
          <span>Total weight ({unit})</span>
          <input
            id={weightId}
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
      </div>
      <div className="plate-bars">
        <span className="small-text muted">Bar</span>
        <div className="row" role="group" aria-label="Bar weight">
          {gym.bars.map((b) => (
            <button
              key={b}
              type="button"
              className={bar === b ? 'chip small on' : 'chip small'}
              aria-pressed={bar === b}
              onClick={() => setBar(b)}
            >
              {b} {unit}
            </button>
          ))}
        </div>
      </div>

      {load && (
        <div className="plate-result" aria-live="polite">
          {load.belowBar ? (
            <p className="muted">
              Lighter than the {bar} {unit} bar.
            </p>
          ) : (
            <>
              <BarDrawing perSide={load.perSide} style={PLATE_STYLE[unit]} />
              <p className="plate-summary">
                {load.perSide.length === 0 ? (
                  <>Just the bar</>
                ) : (
                  <>
                    Each side: <strong>{load.perSide.map(fmt).join(' + ')}</strong>
                  </>
                )}
              </p>
              {load.leftOver > 0 && (
                <p className="muted small-text">
                  {fmt(load.leftOver)} {unit} can't be made with these plates: this loads{' '}
                  {fmt(total! - load.leftOver)} {unit}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** One side of the bar: sleeve with the plates, heaviest next to the collar. */
function BarDrawing({ perSide, style }: { perSide: number[]; style: PlateStyle }) {
  return (
    <div className="plate-bar" aria-hidden="true">
      <span className="plate-collar" />
      {perSide.map((p, i) => (
        <span
          key={i}
          className="plate"
          style={{
            background: style[p]?.color ?? 'var(--muted)',
            height: `${style[p]?.height ?? 50}%`,
          }}
        />
      ))}
      <span className="plate-sleeve" />
    </div>
  )
}
