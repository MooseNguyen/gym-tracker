import { Link } from 'react-router'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { QueryState } from '../../shared/ui/QueryState'
import type { Workout } from '../../types/db'
import { prCounts, useWorkoutPrs, useWorkouts } from './api'
import { PrBadge } from './PrBadge'
import { formatDate, formatKg, formatSetValues, formatTime } from './format'
import { exerciseSummary, groupsTrained, workoutStats } from './summary'

/** Exercises listed on a card; the rest collapse into "+N more". */
const SHOWN_EXERCISES = 3

export function HistoryPage() {
  const q = useWorkouts()
  const workouts = q.data?.pages.flat() ?? []
  // A badge, not essential: the cards show without it while it loads or if it fails.
  const prs = prCounts(useWorkoutPrs(workouts.map((w) => w.id)).data)

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
        <ul className="list card-list">
          {workouts.map((w) => (
            <li key={w.id}>
              <WorkoutCard workout={w} prs={prs.get(w.id) ?? 0} />
            </li>
          ))}
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

function WorkoutCard({ workout: w, prs }: { workout: Workout; prs: number }) {
  const stats = workoutStats(w)
  const groups = groupsTrained(w)
  const hidden = w.workout_exercises.length - SHOWN_EXERCISES

  return (
    <Link to={`/history/${w.id}`} className="card history-card">
      <div className="row between">
        <strong className="history-name">{w.name}</strong>
        <small className="muted">
          {formatDate(w.started_at)} · {formatTime(w.started_at)}
        </small>
      </div>
      {prs > 0 && <PrBadge count={prs} />}

      <dl className="history-stats">
        <div>
          <dt>Time</dt>
          <dd>{stats.minutes} min</dd>
        </div>
        <div>
          <dt>Sets</dt>
          <dd>{stats.workingSets}</dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd>{formatKg(stats.volume)}</dd>
        </div>
      </dl>

      <ul className="history-exercises">
        {w.workout_exercises.slice(0, SHOWN_EXERCISES).map((we) => {
          const s = exerciseSummary(we.exercise.kind, we.sets)
          return (
            <li key={we.id}>
              <ExerciseThumb
                imagePath={we.exercise.image_path}
                name={we.exercise.name}
                size={32}
                decorative
              />
              <span className="grow">
                {s.workingSets} × {we.exercise.name}
              </span>
              {s.best && (
                <small className="muted">best {formatSetValues(we.exercise.kind, s.best)}</small>
              )}
            </li>
          )
        })}
        {hidden > 0 && <li className="muted">+{hidden} more</li>}
      </ul>

      {groups.length > 0 && (
        <ul className="tag-list" aria-label="Muscles trained">
          {groups.map((g) => (
            <li key={g} className="badge">
              {g}
            </li>
          ))}
        </ul>
      )}
      {w.notes && <p className="muted clamp-1">{w.notes}</p>}
    </Link>
  )
}
