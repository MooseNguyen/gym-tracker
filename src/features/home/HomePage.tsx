import { Link, useNavigate } from 'react-router'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { HeroCanvas } from '../../shared/ui/HeroCanvas'
import { Disclosure } from '../../shared/ui/Disclosure'
import { QueryState } from '../../shared/ui/QueryState'
import type { Routine, RoutineFolder } from '../../types/db'
import {
  groupByFolder,
  useDeleteFolder,
  useFolders,
  useRoutines,
  useSaveFolder,
} from '../routines/api'
import { useDraft } from '../workout/draftStore'
import { startEmptyWorkout, startRoutine } from '../workout/startWorkout'

export function HomePage() {
  const draft = useDraft()
  const navigate = useNavigate()
  const routines = useRoutines()
  const folders = useFolders()
  const saveFolder = useSaveFolder()
  const deleteFolder = useDeleteFolder()

  const groups = groupByFolder(folders.data ?? [], routines.data ?? [])
  const mutationError = saveFolder.error ?? deleteFolder.error

  function newFolder() {
    const name = prompt('Folder name')?.trim()
    if (name) saveFolder.mutate({ name })
  }

  function renameFolder(f: RoutineFolder) {
    const name = prompt('Rename folder', f.name)?.trim()
    if (name && name !== f.name) saveFolder.mutate({ id: f.id, name })
  }

  function removeFolder(f: RoutineFolder) {
    if (confirm(`Delete folder "${f.name}"? Its routines are kept and become unfiled.`)) {
      deleteFolder.mutate(f.id)
    }
  }

  const start = (r: Routine) => startRoutine(draft, r) && navigate('/workout')

  return (
    <main className="page home">
      <header className="hero">
        <HeroCanvas />
        <div className="hero-text">
          <p className="eyebrow">{todayLabel()}</p>
          <h1>Ready to train?</h1>
        </div>
      </header>

      {draft && (
        <Link to="/workout" className="card resume">
          <span className="resume-dot" aria-hidden="true" />
          <div>
            <strong>{draft.mode === 'edit' ? 'Continue editing' : 'Resume workout'}</strong>
            <div className="muted">{draft.name}</div>
          </div>
        </Link>
      )}

      <div className="row between">
        <h2>Routines</h2>
        <div className="row">
          <button className="btn small" onClick={newFolder} disabled={saveFolder.isPending}>
            + Folder
          </button>
          <Link className="btn small" to="/routines/new">
            + Routine
          </Link>
        </div>
      </div>

      {mutationError && (
        <p role="alert" className="error">
          {mutationError.message}
        </p>
      )}

      <QueryState
        isPending={routines.isPending || folders.isPending}
        error={routines.error ?? folders.error}
        onRetry={() => {
          routines.refetch()
          folders.refetch()
        }}
        isEmpty={groups.length === 0}
        empty={
          <p>
            No routines yet. Create a folder (e.g. "Push Pull Legs") and add the routines you repeat
            every week.
          </p>
        }
      >
        <div className="stack">
          {groups.map(({ folder, routines }) => (
            <Disclosure
              key={folder?.id ?? 'unfiled'}
              className="folder"
              defaultOpen
              summary={
                <span className="folder-title">
                  <FolderIcon />
                  <span className="grow">{folder?.name ?? 'Unfiled'}</span>
                  <span className="badge">{routines.length}</span>
                </span>
              }
              actions={
                folder && (
                  <div className="row folder-actions">
                    <Link
                      className="icon-btn"
                      to={`/routines/new?folder=${folder.id}`}
                      aria-label={`Add routine to ${folder.name}`}
                      title="Add routine"
                    >
                      +
                    </Link>
                    <button
                      className="icon-btn"
                      aria-label={`Rename ${folder.name}`}
                      title="Rename"
                      onClick={() => renameFolder(folder)}
                    >
                      ✎
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`Delete ${folder.name}`}
                      title="Delete"
                      onClick={() => removeFolder(folder)}
                    >
                      ✕
                    </button>
                  </div>
                )
              }
            >
              {routines.length === 0 ? (
                <p className="muted small-text folder-empty">
                  Empty folder.{' '}
                  {folder && <Link to={`/routines/new?folder=${folder.id}`}>Add a routine</Link>}
                </p>
              ) : (
                <div className="stack">
                  {routines.map((r) => (
                    <RoutineItem key={r.id} routine={r} onStart={() => start(r)} />
                  ))}
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      </QueryState>

      <button
        className="btn primary block start-empty"
        onClick={() => startEmptyWorkout(draft) && navigate('/workout')}
      >
        Start empty workout
      </button>
    </main>
  )
}

function RoutineItem({ routine, onStart }: { routine: Routine; onStart: () => void }) {
  const exercises = routine.routine_exercises
  return (
    <Disclosure
      className="routine card"
      summary={
        <span className="routine-summary">
          <strong>{routine.name}</strong>
          <small className="muted">
            {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          </small>
        </span>
      }
    >
      {exercises.length === 0 ? (
        <p className="muted small-text">No exercises in this routine yet.</p>
      ) : (
        <ol className="routine-exercises">
          {exercises.map((re) => (
            <li key={re.id}>
              <ExerciseThumb imagePath={re.exercise.image_path} name={re.exercise.name} size={40} />
              <span className="grow">{re.exercise.name}</span>
              <small className="muted">
                {re.target_sets} set{re.target_sets === 1 ? '' : 's'}
              </small>
            </li>
          ))}
        </ol>
      )}
      <div className="row">
        <Link className="btn" to={`/routines/${routine.id}`}>
          Edit
        </Link>
        <button className="btn primary grow" disabled={exercises.length === 0} onClick={onStart}>
          Start {routine.name}
        </button>
      </div>
    </Disclosure>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        fill="currentColor"
      />
    </svg>
  )
}

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const todayLabel = () => dayFmt.format(new Date())
