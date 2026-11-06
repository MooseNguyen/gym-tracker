import { Link, useNavigate } from 'react-router'
import { QueryState } from '../../shared/ui/QueryState'
import { useRoutines } from '../routines/api'
import { useDraft } from '../workout/draftStore'
import { startEmptyWorkout, startRoutine } from '../workout/startWorkout'

export function HomePage() {
  const draft = useDraft()
  const navigate = useNavigate()
  const routines = useRoutines()

  return (
    <main className="page">
      <h1>Workout</h1>

      {draft && (
        <Link to="/workout" className="card resume">
          <strong>{draft.mode === 'edit' ? 'Continue editing' : 'Resume workout'}</strong>
          <span className="muted">{draft.name}</span>
        </Link>
      )}

      <button
        className="btn primary block"
        onClick={() => startEmptyWorkout(draft) && navigate('/workout')}
      >
        Start empty workout
      </button>

      <div className="row between">
        <h2>Routines</h2>
        <Link className="btn small" to="/routines/new">
          + New routine
        </Link>
      </div>

      <QueryState
        isPending={routines.isPending}
        error={routines.error}
        onRetry={routines.refetch}
        isEmpty={routines.data?.length === 0}
        empty={<p>No routines yet. Create one for the workouts you repeat every week.</p>}
      >
        <ul className="list">
          {routines.data?.map((r) => (
            <li key={r.id} className="card stack">
              <div className="row between">
                <strong>{r.name}</strong>
                <Link
                  className="btn small ghost"
                  to={`/routines/${r.id}`}
                  aria-label={`Edit ${r.name}`}
                >
                  Edit
                </Link>
              </div>
              <small className="muted">
                {r.routine_exercises.map((re) => re.exercise.name).join(', ') || 'No exercises'}
              </small>
              <button
                className="btn"
                disabled={r.routine_exercises.length === 0}
                onClick={() => startRoutine(draft, r) && navigate('/workout')}
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      </QueryState>
    </main>
  )
}
