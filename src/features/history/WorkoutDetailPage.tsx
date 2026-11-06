import { Link, useNavigate, useParams } from 'react-router'
import { QueryState } from '../../shared/ui/QueryState'
import { totalVolume } from '../../shared/calc'
import { useDraft } from '../workout/draftStore'
import { editWorkout } from '../workout/startWorkout'
import { useDeleteWorkout, useWorkout } from './api'
import { durationMinutes, formatDate, formatSet } from './format'

export function WorkoutDetailPage() {
  const { id } = useParams()
  const q = useWorkout(id)
  const del = useDeleteWorkout()
  const draft = useDraft()
  const navigate = useNavigate()
  const w = q.data

  return (
    <main className="page">
      <QueryState isPending={q.isPending} error={q.error} onRetry={q.refetch}>
        {w && (
          <div className="stack">
            <h1>{w.name}</h1>
            <p className="muted">
              {formatDate(w.started_at)} · {durationMinutes(w.started_at, w.ended_at)} min ·{' '}
              {totalVolume(w.workout_exercises.flatMap((we) => we.sets))} kg
            </p>
            {w.notes && <p>{w.notes}</p>}

            {w.workout_exercises.map((we) => (
              <section key={we.id} className="card stack">
                <Link to={`/exercises/${we.exercise_id}`}>
                  <h2 className="exercise-title">{we.exercise.name}</h2>
                </Link>
                {we.notes && <small className="muted">{we.notes}</small>}
                <ol className="set-list">
                  {we.sets.map((s) => (
                    <li key={s.id}>{formatSet(we.exercise.kind, s)}</li>
                  ))}
                </ol>
              </section>
            ))}

            {del.error && (
              <p role="alert" className="error">
                {del.error.message}
              </p>
            )}
            <div className="row">
              <button
                className="btn danger"
                disabled={del.isPending}
                onClick={() =>
                  confirm('Delete this workout permanently?') &&
                  del.mutate(w.id, { onSuccess: () => navigate('/history', { replace: true }) })
                }
              >
                Delete
              </button>
              <button
                className="btn primary grow"
                onClick={() => editWorkout(draft, w) && navigate('/workout')}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </QueryState>
    </main>
  )
}
