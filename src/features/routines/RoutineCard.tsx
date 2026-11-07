import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useConfirm } from '../../shared/ui/confirmContext'
import { Dialog } from '../../shared/ui/Dialog'
import { Disclosure } from '../../shared/ui/Disclosure'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import type { Routine } from '../../types/db'
import { useDeleteRoutine, useSaveRoutine } from './api'
import { duplicateName, duplicatePayload, routineShareText } from './routineActions'

interface Props {
  routine: Routine
  /** Every routine name, so a duplicate gets a free one. */
  routineNames: string[]
  onStart: () => void
}

/**
 * A routine on Home: the name opens the exercise list, Start is always
 * visible, and ⋯ opens an action sheet (edit, duplicate, share, delete).
 */
export function RoutineCard({ routine, routineNames, onStart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const confirm = useConfirm()
  const del = useDeleteRoutine()
  const exercises = routine.routine_exercises

  // Lives here, not in the menu: the menu closes before the confirm opens,
  // and the result (or error) must outlive it.
  async function remove() {
    setMenuOpen(false)
    const ok = await confirm({
      title: `Delete routine "${routine.name}"?`,
      message: 'Past workouts are kept.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) del.mutate(routine.id)
  }

  return (
    <div className="card routine-card">
      <Disclosure
        className="routine"
        summary={
          <span className="routine-summary">
            <strong>{routine.name}</strong>
            <small className="muted">
              {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
            </small>
          </span>
        }
        actions={
          <button
            type="button"
            className="icon-btn"
            aria-label={`More actions for ${routine.name}`}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="5" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="19" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
        }
      >
        {exercises.length === 0 ? (
          <p className="muted small-text">No exercises in this routine yet.</p>
        ) : (
          <ol className="routine-exercises">
            {exercises.map((re) => (
              <li key={re.id}>
                <ExerciseThumb
                  imagePath={re.exercise.image_path}
                  name={re.exercise.name}
                  size={40}
                />
                <span className="grow">{re.exercise.name}</span>
                <small className="muted">
                  {re.target_sets} set{re.target_sets === 1 ? '' : 's'}
                </small>
              </li>
            ))}
          </ol>
        )}
      </Disclosure>

      <button
        type="button"
        className="btn primary block"
        // Visible text is the same on every card; the name tells them apart.
        aria-label={`Start ${routine.name}`}
        disabled={exercises.length === 0}
        onClick={onStart}
      >
        Start Routine
      </button>
      {del.error && (
        <p role="alert" className="error">
          {del.error.message}
        </p>
      )}

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={routine.name}>
        <RoutineMenu
          routine={routine}
          routineNames={routineNames}
          onDelete={remove}
          onDone={() => setMenuOpen(false)}
        />
      </Dialog>
    </div>
  )
}

function RoutineMenu({
  routine,
  routineNames,
  onDelete,
  onDone,
}: {
  routine: Routine
  routineNames: string[]
  onDelete: () => void
  onDone: () => void
}) {
  const navigate = useNavigate()
  const save = useSaveRoutine()
  const [status, setStatus] = useState<string | null>(null)

  function duplicate() {
    const name = duplicateName(routine.name, routineNames)
    save.mutate(duplicatePayload(routine, name), { onSuccess: onDone })
  }

  async function share() {
    const text = routineShareText(routine)
    setStatus(null)
    // The native share sheet where there is one (phones); the clipboard elsewhere.
    if (navigator.share) {
      try {
        await navigator.share({ title: routine.name, text })
        onDone()
      } catch (e) {
        // Closing the share sheet is not an error.
        if ((e as Error).name !== 'AbortError') setStatus('Could not open sharing.')
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied to the clipboard.')
    } catch {
      setStatus('Could not copy. Your browser blocked the clipboard.')
    }
  }

  return (
    <div className="stack action-sheet">
      <button
        type="button"
        className="btn block"
        onClick={() => navigate(`/routines/${routine.id}`)}
      >
        Edit routine
      </button>
      <button type="button" className="btn block" onClick={duplicate} disabled={save.isPending}>
        {save.isPending ? 'Duplicating…' : 'Duplicate routine'}
      </button>
      <button type="button" className="btn block" onClick={share}>
        Share routine
      </button>
      <button type="button" className="btn block danger" onClick={onDelete}>
        Delete routine
      </button>
      <p className="muted small-text" role="status">
        {status}
      </p>
      {save.error && (
        <p role="alert" className="error">
          {save.error.message}
        </p>
      )}
    </div>
  )
}
