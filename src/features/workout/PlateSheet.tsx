import { useId, useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { parseNumber } from './draft'
import { KG_BARS, KG_PLATES, platesPerSide } from './plates'

/** Competition (IWF) plate colours, so the drawing matches the plates in the rack. */
const PLATE_STYLE: Record<number, { color: string; height: number }> = {
  25: { color: '#d64545', height: 100 },
  20: { color: '#3b6fd6', height: 100 },
  15: { color: '#e0b93a', height: 92 },
  10: { color: '#3f9e5a', height: 82 },
  5: { color: '#e8e8e8', height: 64 },
  2.5: { color: '#d64545', height: 52 },
  1.25: { color: '#b9bec4', height: 44 },
}

const fmt = (n: number) => String(n).replace(/\.0+$/, '')

/**
 * "What goes on the bar?" for a target weight: plates per side, drawn on a
 * bar, with what can't be made exactly. Opens on the weight of the next set.
 */
export function PlateSheet({
  open,
  initialWeight,
  onClose,
}: {
  open: boolean
  initialWeight: number | null
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Plate calculator">
      {/* Remounted on every open, so it starts from the current set's weight. */}
      {open && <PlateCalculator initialWeight={initialWeight} />}
    </Dialog>
  )
}

function PlateCalculator({ initialWeight }: { initialWeight: number | null }) {
  const [bar, setBar] = useState<number>(KG_BARS[0])
  const [input, setInput] = useState(initialWeight ? fmt(initialWeight) : '')
  const weightId = useId()
  const total = parseNumber(input)
  const load = total != null && total > 0 ? platesPerSide(total, bar, KG_PLATES) : null

  return (
    <div className="stack plate-calc">
      <div className="row">
        <label className="field" htmlFor={weightId}>
          <span>Total weight (kg)</span>
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
          {KG_BARS.map((b) => (
            <button
              key={b}
              type="button"
              className={bar === b ? 'chip small on' : 'chip small'}
              aria-pressed={bar === b}
              onClick={() => setBar(b)}
            >
              {b} kg
            </button>
          ))}
        </div>
      </div>

      {load && (
        <div className="plate-result" aria-live="polite">
          {load.belowBar ? (
            <p className="muted">Lighter than the {bar} kg bar.</p>
          ) : (
            <>
              <BarDrawing perSide={load.perSide} />
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
                  {fmt(load.leftOver)} kg can't be made with these plates: this loads{' '}
                  {fmt(total! - load.leftOver)} kg.
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
function BarDrawing({ perSide }: { perSide: number[] }) {
  return (
    <div className="plate-bar" aria-hidden="true">
      <span className="plate-collar" />
      {perSide.map((p, i) => (
        <span
          key={i}
          className="plate"
          style={{
            background: PLATE_STYLE[p]?.color ?? 'var(--muted)',
            height: `${PLATE_STYLE[p]?.height ?? 50}%`,
          }}
        />
      ))}
      <span className="plate-sleeve" />
    </div>
  )
}
