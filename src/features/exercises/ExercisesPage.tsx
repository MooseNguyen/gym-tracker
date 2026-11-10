import { useState } from 'react'
import { Link } from 'react-router'
import { useConfirm } from '../../shared/ui/confirmContext'
import { Dialog } from '../../shared/ui/Dialog'
import { QueryState } from '../../shared/ui/QueryState'
import type { Exercise } from '../../types/db'
import { useIsAdmin } from '../auth/AuthProvider'
import { useDeleteExercise, useExerciseInstructions, useExercises } from './api'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseList } from './ExerciseList'
import { HiddenBuiltIns } from './HiddenBuiltIns'
import { HowToButton } from './HowTo'

export function ExercisesPage() {
  const { data = [], isPending, error, refetch } = useExercises()
  const del = useDeleteExercise()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  return (
    <main className="page">
      <div className="row between">
        <h1>Exercises</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>
          + New
        </button>
      </div>
      {isAdmin && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          <span>Show hidden built-ins</span>
        </label>
      )}
      {isAdmin && showHidden && <HiddenBuiltIns onEdit={setEditing} />}
      {del.error && (
        <p role="alert" className="error">
          {del.error.message}
        </p>
      )}
      <QueryState isPending={isPending} error={error} onRetry={refetch}>
        <ExerciseList
          exercises={data}
          renderAction={(e) => (
            <div className="row">
              {!e.user_id && (
                <HowToButton
                  exercise={{
                    id: e.id,
                    name: e.name,
                    imagePath: e.image_path,
                    imagePathEnd: e.image_path_end,
                  }}
                />
              )}
              {/* RLS returns only built-ins and the member's own custom ones. */}
              {(isAdmin || e.user_id) && (
                <button
                  className="icon-btn"
                  aria-label={`Edit ${e.name}`}
                  title="Edit"
                  onClick={() => setEditing(e)}
                >
                  ✎
                </button>
              )}
              <Link className="btn small" to={`/exercises/${e.id}`}>
                Stats
              </Link>
              {e.user_id && (
                <button
                  className="btn small danger"
                  aria-label={`Delete ${e.name}`}
                  disabled={del.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${e.name}"?`,
                      message: 'This custom exercise is removed from your library.',
                      confirmLabel: 'Delete',
                      danger: true,
                    })
                    if (ok) del.mutate(e)
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          )}
        />
      </QueryState>
      {/* RepDB's free tier requires a visible credit where its data is shown. */}
      <p className="muted small-text">
        Exercise data by{' '}
        <a href="https://repdb.co" target="_blank" rel="noreferrer">
          RepDB (repdb.co)
        </a>
        .
      </p>
      <Dialog open={adding} onClose={() => setAdding(false)} title="New exercise">
        <ExerciseForm library={data} onDone={() => setAdding(false)} />
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit exercise">
        {editing &&
          (editing.user_id ? (
            <ExerciseForm
              key={editing.id}
              exercise={editing}
              library={data}
              onDone={() => setEditing(null)}
            />
          ) : (
            <EditBuiltIn
              key={editing.id}
              exercise={editing}
              library={data}
              onDone={() => setEditing(null)}
            />
          ))}
      </Dialog>
    </main>
  )
}

/** Loads the steps first, so the form starts with them filled in. */
function EditBuiltIn({
  exercise,
  library,
  onDone,
}: {
  exercise: Exercise
  library: Exercise[]
  onDone: () => void
}) {
  const steps = useExerciseInstructions(exercise.id, true)
  return (
    <QueryState isPending={steps.isPending} error={steps.error} onRetry={steps.refetch}>
      <ExerciseForm
        exercise={exercise}
        initialSteps={steps.data}
        library={library}
        onDone={onDone}
      />
    </QueryState>
  )
}
