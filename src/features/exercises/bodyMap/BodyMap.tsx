import { BACK, FRONT } from './data'
import { groupForRegion } from '../filters'

interface Props {
  side: 'front' | 'back'
  selected: ReadonlySet<string>
  onToggle: (group: string) => void
}

/**
 * Tappable body outline. Selected muscle groups light up in the accent colour.
 * It is a shortcut for pointer users: the chip list next to it is the
 * accessible control, so the drawing itself is hidden from screen readers
 * (otherwise every group would be announced twice).
 */
export function BodyMap({ side, selected, onToggle }: Props) {
  const regions = side === 'front' ? FRONT : BACK
  return (
    <svg
      className="body-map"
      viewBox="0 0 1000 2000"
      aria-hidden="true"
      data-testid={`body-map-${side}`}
    >
      {regions.map((r) => {
        const group = groupForRegion(r.muscle)
        const on = group != null && selected.has(group)
        const cls = ['region', group ? 'selectable' : 'decor', on ? 'on' : ''].join(' ')
        return r.points.map((points, i) => (
          <polygon
            key={`${r.muscle}-${i}`}
            className={cls}
            points={points}
            data-region={r.muscle}
            onClick={group ? () => onToggle(group) : undefined}
          />
        ))
      })}
    </svg>
  )
}
