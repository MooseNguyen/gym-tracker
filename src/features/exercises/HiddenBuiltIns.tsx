import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { QueryState } from '../../shared/ui/QueryState'
import { muscleLabel, type Exercise } from '../../types/db'
import { useHiddenExercises, useSetExerciseHidden } from './api'

/**
 * Admin only: the built-ins hidden from every list and picker, with a way
 * back. Retired ones have no photo or steps; unhiding them is allowed anyway
 * (placeholder photo, "no instructions"), and ✎ can add both later.
 */
export function HiddenBuiltIns({ onEdit }: { onEdit: (exercise: Exercise) => void }) {
  const { data = [], isPending, error, refetch } = useHiddenExercises(true)
  const setHidden = useSetExerciseHidden()

  return (
    <section className="stack" aria-labelledby="hidden-built-ins">
      <h2 id="hidden-built-ins">
        Hidden built-ins {!isPending && !error && <span className="badge">{data.length}</span>}
      </h2>
      <p className="muted small-text">
        Not offered in lists or pickers; workouts and routines that use them still show them.
        Unhiding brings one back for every user.
      </p>
      {setHidden.error && (
        <p role="alert" className="error">
          {setHidden.error.message}
        </p>
      )}
      <QueryState
        isPending={isPending}
        error={error}
        onRetry={refetch}
        isEmpty={data.length === 0}
        empty="No hidden built-ins."
      >
        <ul className="list">
          {data.map((e) => {
            const unhiding = setHidden.isPending && setHidden.variables?.id === e.id
            return (
              <li key={e.id} className="list-item">
                <ExerciseThumb imagePath={e.image_path} name={e.name} size={48} />
                <div className="grow">
                  <div>{e.name}</div>
                  <small className="muted">
                    {muscleLabel(e.muscle_group)} · {e.equipment}
                  </small>
                </div>
                <div className="row">
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${e.name}`}
                    title="Edit"
                    onClick={() => onEdit(e)}
                  >
                    ✎
                  </button>
                  <button
                    className="btn small"
                    aria-label={`Unhide ${e.name}`}
                    disabled={setHidden.isPending}
                    onClick={() => setHidden.mutate({ id: e.id, hidden: false })}
                  >
                    {unhiding ? 'Unhiding…' : 'Unhide'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </QueryState>
    </section>
  )
}
