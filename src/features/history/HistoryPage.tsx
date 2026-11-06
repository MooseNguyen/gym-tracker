import { Link } from 'react-router'
import { QueryState } from '../../shared/ui/QueryState'
import { totalVolume } from '../../shared/calc'
import { useWorkouts } from './api'
import { durationMinutes, formatDate } from './format'

export function HistoryPage() {
  const q = useWorkouts()
  const workouts = q.data?.pages.flat() ?? []

  return (
    <main className="page">
      <h1>History</h1>
      <QueryState
        isPending={q.isPending}
        error={q.error}
        onRetry={q.refetch}
        isEmpty={workouts.length === 0}
        empty={<p>No workouts yet. Finished workouts show up here.</p>}
      >
        <ul className="list">
          {workouts.map((w) => {
            const sets = w.workout_exercises.flatMap((we) => we.sets)
            return (
              <li key={w.id}>
                <Link to={`/history/${w.id}`} className="card stack">
                  <div className="row between">
                    <strong>{w.name}</strong>
                    <small className="muted">{formatDate(w.started_at)}</small>
                  </div>
                  <small className="muted">
                    {durationMinutes(w.started_at, w.ended_at)} min · {sets.length} sets ·{' '}
                    {totalVolume(sets)} kg
                  </small>
                  <small>{w.workout_exercises.map((we) => we.exercise.name).join(', ')}</small>
                </Link>
              </li>
            )
          })}
        </ul>
        {q.hasNextPage && (
          <button
            className="btn block"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </QueryState>
    </main>
  )
}
