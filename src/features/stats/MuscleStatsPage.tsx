import { useMemo, useState } from 'react'
import { QueryState } from '../../shared/ui/QueryState'
import { useWorkoutsBetween } from '../history/api'
import { MuscleVolumeBars } from './MuscleVolumeBars'
import { groupVolumes, WEEKLY_TARGET, weekRange } from './muscleVolume'

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

function weekTitle(offset: number) {
  if (offset === 0) return 'This week'
  if (offset === -1) return 'Last week'
  return `${-offset} weeks ago`
}

/** Working sets per muscle group for one week (Mon–Sun), with week-by-week navigation. */
export function MuscleStatsPage() {
  const [offset, setOffset] = useState(0)
  const { from, to } = useMemo(() => weekRange(new Date(), offset), [offset])
  const q = useWorkoutsBetween(from, to)
  const workouts = q.data ?? []
  const groups = groupVolumes(workouts)
  const inRange = groups.filter((g) => g.status === 'ok').length

  const lastDay = new Date(to)
  lastDay.setDate(to.getDate() - 1)

  return (
    <main className="page">
      <h1>Muscles</h1>

      <div className="week-nav">
        <button
          type="button"
          className="btn small"
          aria-label="Previous week"
          onClick={() => setOffset((o) => o - 1)}
        >
          ←
        </button>
        <div className="week-nav-title">
          <strong>{weekTitle(offset)}</strong>
          <small className="muted">
            {dayFmt.format(from)} – {dayFmt.format(lastDay)}
          </small>
        </div>
        <button
          type="button"
          className="btn small"
          aria-label="Next week"
          disabled={offset >= 0}
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
        >
          →
        </button>
      </div>

      <QueryState isPending={q.isPending} error={q.error} onRetry={q.refetch}>
        <section className="card stack" aria-label="Sets per muscle group">
          <p className="muted">
            {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'} · {inRange} of{' '}
            {groups.length} groups in the {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max} sets range
          </p>
          <MuscleVolumeBars groups={groups} />
        </section>
        <p className="muted small-text">
          Working sets (no warm-ups), each counted for the exercise&apos;s main muscle. The shaded
          band is the common {WEEKLY_TARGET.min}–{WEEKLY_TARGET.max} sets per week guideline for
          muscle growth: a reference, not a rule.
        </p>
      </QueryState>
    </main>
  )
}
