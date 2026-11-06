import { muscleLabel } from '../../types/db'
import { WEEKLY_TARGET, type GroupVolume, type VolumeStatus } from './muscleVolume'

const STATUS_LABEL: Record<VolumeStatus, string> = {
  none: 'Not trained',
  low: `Below ${WEEKLY_TARGET.min}`,
  ok: 'In range',
  high: `Above ${WEEKLY_TARGET.max}`,
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Props {
  groups: GroupVolume[]
  /** Home card: no sub-muscles, no status text. */
  compact?: boolean
}

/**
 * One bar per muscle group against the 10–20 sets band. The status is also
 * written out (colour alone would not reach everyone).
 */
export function MuscleVolumeBars({ groups, compact = false }: Props) {
  // The scale always shows the whole band, plus room when a group goes past it.
  const scale = Math.max(WEEKLY_TARGET.max + 5, ...groups.map((g) => g.sets))
  const pct = (n: number) => `${(n / scale) * 100}%`
  const band = {
    left: pct(WEEKLY_TARGET.min),
    width: pct(WEEKLY_TARGET.max - WEEKLY_TARGET.min),
  }

  return (
    <ul className={compact ? 'volume-bars compact' : 'volume-bars'}>
      {groups.map((g) => (
        <li key={g.group} className={`volume-row ${g.status}`}>
          <span className="volume-label">{capitalize(g.group)}</span>
          <span className="volume-track" aria-hidden="true">
            <span className="volume-band" style={band} />
            <span className="volume-fill" style={{ width: pct(g.sets) }} />
          </span>
          <span className="volume-value">
            <strong>{g.sets}</strong>
            {!compact && <small> · {STATUS_LABEL[g.status]}</small>}
          </span>
          {!compact && g.sets > 0 && g.muscles.length > 0 && (
            <ul className="volume-subs" aria-label={`${capitalize(g.group)} by target`}>
              {g.muscles.map((m) => (
                <li key={m.muscle}>
                  {m.muscle === g.group ? 'general' : muscleLabel(m.muscle)}{' '}
                  <span className="muted">{m.sets}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
