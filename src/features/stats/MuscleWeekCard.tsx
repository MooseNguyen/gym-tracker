import { useMemo } from 'react'
import { Link } from 'react-router'
import { useWorkoutsBetween } from '../history/api'
import { MuscleVolumeBars } from './MuscleVolumeBars'
import { groupVolumes, WEEKLY_TARGET, weekRange } from './muscleVolume'

/**
 * Home summary of this week's sets per muscle group. Only trained groups get
 * a bar, to keep Home short; the full list lives on /stats.
 */
export function MuscleWeekCard() {
  // One "this week" per mount, like the week strip.
  const { from, to } = useMemo(() => weekRange(new Date()), [])
  const q = useWorkoutsBetween(from, to)
  if (!q.data) return null // the week strip above already shows loading and errors

  const groups = groupVolumes(q.data)
  const trained = groups.filter((g) => g.sets > 0)
  const inRange = groups.filter((g) => g.status === 'ok').length

  return (
    <Link to="/stats" className="card stack muscle-week-card" aria-label="Muscles this week">
      <div className="row between">
        <h2>Muscles this week</h2>
        <span className="muted" aria-hidden="true">
          →
        </span>
      </div>
      {trained.length === 0 ? (
        <p className="muted">No sets yet this week. Your first workout fills this in.</p>
      ) : (
        <>
          <p className="muted">
            {inRange} of {groups.length} groups at {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max} sets
          </p>
          <MuscleVolumeBars groups={trained} compact />
        </>
      )}
    </Link>
  )
}
