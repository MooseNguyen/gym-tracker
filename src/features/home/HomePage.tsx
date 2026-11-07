import { Link, useNavigate } from 'react-router'
import { HeroCanvas } from '../../shared/ui/HeroCanvas'
import { MuscleWeekCard } from '../stats/MuscleWeekCard'
import { RoutineCard } from '../routines/RoutineCard'
import { WeekStrip } from './WeekStrip'
import { useConfirm, usePrompt } from '../../shared/ui/confirmContext'
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
import { useUnit } from '../settings/api'

export function HomePage() {
  const draft = useDraft()
  const unit = useUnit()
  const navigate = useNavigate()
  const routines = useRoutines()
  const folders = useFolders()
  const saveFolder = useSaveFolder()
  const deleteFolder = useDeleteFolder()
  const confirm = useConfirm()
  const prompt = usePrompt()

  const groups = groupByFolder(folders.data ?? [], routines.data ?? [])
  const routineNames = (routines.data ?? []).map((r) => r.name)
  const mutationError = saveFolder.error ?? deleteFolder.error

  async function newFolder() {
    const name = await prompt({ title: 'New folder', label: 'Folder name', confirmLabel: 'Create' })
    if (name) saveFolder.mutate({ name })
  }

  async function renameFolder(f: RoutineFolder) {
    const name = await prompt({
      title: 'Rename folder',
      label: 'Folder name',
      initialValue: f.name,
    })
    if (name && name !== f.name) saveFolder.mutate({ id: f.id, name })
  }

  async function removeFolder(f: RoutineFolder) {
    const ok = await confirm({
      title: `Delete folder "${f.name}"?`,
      message: 'Its routines are kept and become unfiled.',
      confirmLabel: 'Delete folder',
      danger: true,
    })
    if (ok) deleteFolder.mutate(f.id)
  }

  const start = (r: Routine) => startRoutine(draft, r, unit) && navigate('/workout')

  return (
    <main className="page home">
      <header className="hero">
        <HeroCanvas />
        <div className="hero-text">
          <p className="eyebrow">{todayLabel()}</p>
          <h1>Ready to train?</h1>
        </div>
      </header>

      <WeekStrip />
      <MuscleWeekCard />

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
                    <RoutineCard
                      key={r.id}
                      routine={r}
                      routineNames={routineNames}
                      onStart={() => start(r)}
                    />
                  ))}
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      </QueryState>

      <button
        className="btn primary block start-empty"
        onClick={() => startEmptyWorkout(draft, unit) && navigate('/workout')}
      >
        Start empty workout
      </button>
    </main>
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
