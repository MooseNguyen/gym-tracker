import { Link, useNavigate, useParams } from 'react-router'
import { estimate1RM } from '../../shared/calc'
import { useConfirm } from '../../shared/ui/confirmContext'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { QueryState } from '../../shared/ui/QueryState'
import { muscleLabel, type SetRow, type Workout, type WorkoutExerciseRow } from '../../types/db'
import { useDraft } from '../workout/draftStore'
import { editWorkout } from '../workout/startWorkout'
import { useDeleteWorkout, useWorkout } from './api'
import { formatDate, formatKg, formatSetValues, formatTime } from './format'
import { exerciseSummary, setsPerMuscle, workoutStats } from './summary'

export function WorkoutDetailPage() {
  const { id } = useParams()
  const q = useWorkout(id)

  return (
    <main className="page">
      <QueryState isPending={q.isPending} error={q.error} onRetry={q.refetch}>
        {q.data && <WorkoutDetail w={q.data} />}
      </QueryState>
    </main>
  )
}

function WorkoutDetail({ w }: { w: Workout }) {
  const del = useDeleteWorkout()
  const draft = useDraft()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const stats = workoutStats(w)
  const muscles = setsPerMuscle(w)
  const maxSets = Math.max(1, ...muscles.map((m) => m.sets))

  return (
    <div className="stack">
      <h1>{w.name}</h1>
      <p className="muted">
        {formatDate(w.started_at)} · {formatTime(w.started_at)}–{formatTime(w.ended_at)}
      </p>
      {w.notes && <p>{w.notes}</p>}

      <dl className="detail-stats card">
        <div>
          <dt className="stat-label">Duration</dt>
          <dd className="stat-value">{stats.minutes} min</dd>
        </div>
        <div>
          <dt className="stat-label">Volume</dt>
          <dd className="stat-value">{formatKg(stats.volume)}</dd>
        </div>
        <div>
          <dt className="stat-label">Sets</dt>
          <dd className="stat-value">
            {stats.workingSets}
            {stats.warmupSets > 0 && <small className="muted"> +{stats.warmupSets} warm-up</small>}
          </dd>
        </div>
        <div>
          <dt className="stat-label">Reps</dt>
          <dd className="stat-value">{stats.reps}</dd>
        </div>
      </dl>

      {muscles.length > 0 && (
        <section className="card stack" aria-labelledby="muscles-title">
          <h2 id="muscles-title">Muscles</h2>
          <ul className="muscle-bars">
            {muscles.map((m) => (
              <li key={m.muscle}>
                <span className="muscle-bar-label">{muscleLabel(m.muscle)}</span>
                <span className="muscle-bar" aria-hidden="true">
                  <span style={{ width: `${(m.sets / maxSets) * 100}%` }} />
                </span>
                <span className="muted">
                  {m.sets} {m.sets === 1 ? 'set' : 'sets'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {w.workout_exercises.map((we) => (
        <ExerciseBlock key={we.id} we={we} />
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
          onClick={async () => {
            const ok = await confirm({
              title: 'Delete this workout?',
              message: 'It is removed permanently, with all its sets.',
              confirmLabel: 'Delete',
              danger: true,
            })
            if (ok) del.mutate(w.id, { onSuccess: () => navigate('/history', { replace: true }) })
          }}
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
  )
}

/** Warm-ups show "W"; the others are numbered in order, drop/failure tagged. */
function setLabels(sets: SetRow[]): string[] {
  let n = 0
  return sets.map((s) => {
    if (s.set_type === 'warmup') return 'W'
    n++
    if (s.set_type === 'drop') return `${n} D`
    if (s.set_type === 'failure') return `${n} F`
    return String(n)
  })
}

function ExerciseBlock({ we }: { we: WorkoutExerciseRow }) {
  const { exercise } = we
  const summary = exerciseSummary(exercise.kind, we.sets)
  const labels = setLabels(we.sets)
  const showE1RM = exercise.kind === 'weight_reps'

  return (
    <section className="card stack">
      <div className="row">
        <ExerciseThumb imagePath={exercise.image_path} name={exercise.name} size={44} decorative />
        <div className="grow">
          <Link to={`/exercises/${we.exercise_id}`}>
            <h2 className="exercise-title">{exercise.name}</h2>
          </Link>
          <small className="muted">
            {muscleLabel(exercise.muscle_group)} · {exercise.equipment}
          </small>
        </div>
      </div>
      {we.notes && <small className="muted">{we.notes}</small>}

      <table className="set-table">
        <thead>
          <tr>
            <th scope="col">Set</th>
            <th scope="col">{exercise.kind === 'duration' ? 'Time' : 'Load × reps'}</th>
            <th scope="col">RPE</th>
            {showE1RM && <th scope="col">e1RM</th>}
          </tr>
        </thead>
        <tbody>
          {we.sets.map((s, i) => {
            const e1rm = estimate1RM(s.weight_kg, s.reps)
            return (
              <tr key={s.id} className={s.set_type === 'warmup' ? 'muted' : undefined}>
                <td>{labels[i]}</td>
                <td>{formatSetValues(exercise.kind, s)}</td>
                <td>{s.rpe ?? '–'}</td>
                {showE1RM && <td>{e1rm != null && s.set_type !== 'warmup' ? e1rm : '–'}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>

      {summary.best && (
        <p className="exercise-footer muted">
          {exercise.kind !== 'duration' && summary.volume > 0 && (
            <>Volume {formatKg(summary.volume)} · </>
          )}
          Best {formatSetValues(exercise.kind, summary.best)}
          {summary.bestE1RM != null && <> (e1RM {formatKg(summary.bestE1RM)})</>}
        </p>
      )}
    </section>
  )
}
