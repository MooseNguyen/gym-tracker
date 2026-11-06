import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { reorder } from '../../shared/reorder'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { QueryState } from '../../shared/ui/QueryState'
import { DragHandle, SortableList } from '../../shared/ui/SortableList'
import type { Exercise, Routine } from '../../types/db'
import { useDeleteRoutine, useFolders, useRoutine, useSaveRoutine } from './api'

/** /routines/new and /routines/:id share one editor. */
export function RoutineEditorPage() {
  const { id } = useParams()
  const routine = useRoutine(id)

  if (!id) return <RoutineForm />
  return (
    <QueryState isPending={routine.isPending} error={routine.error} onRetry={routine.refetch}>
      {/* key: remount the form if the loaded routine changes */}
      {routine.data && <RoutineForm key={routine.data.id} initial={routine.data} />}
    </QueryState>
  )
}

interface Row {
  // Named `id` so the row can go straight into SortableList and reorder().
  id: string
  exercise: Exercise
  target_sets: number
  rest_seconds: number
}

function RoutineForm({ initial }: { initial?: Routine }) {
  const navigate = useNavigate()
  // "+ Routine" inside a folder on the home page links to /routines/new?folder=<id>.
  const [params] = useSearchParams()
  const folders = useFolders()
  const save = useSaveRoutine()
  const del = useDeleteRoutine()
  const [name, setName] = useState(initial?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [folderId, setFolderId] = useState(initial?.folder_id ?? params.get('folder') ?? '')
  const [rows, setRows] = useState<Row[]>(
    initial?.routine_exercises.map((re) => ({
      id: re.id,
      exercise: re.exercise,
      target_sets: re.target_sets,
      rest_seconds: re.rest_seconds,
    })) ?? [],
  )
  const [picking, setPicking] = useState(false)

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        id: initial?.id,
        name: name.trim(),
        notes: notes.trim() || null,
        folder_id: folderId || null,
        exercises: rows.map((r) => ({
          exercise_id: r.exercise.id,
          target_sets: r.target_sets,
          rest_seconds: r.rest_seconds,
        })),
      },
      { onSuccess: () => navigate('/') },
    )
  }

  return (
    <main className="page">
      <h1>{initial ? 'Edit routine' : 'New routine'}</h1>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push day"
          />
        </label>
        <label className="field">
          <span>Folder</span>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">No folder</option>
            {folders.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <h2>Exercises</h2>
        {rows.length === 0 && <p className="muted center">No exercises yet.</p>}
        <div className="stack">
          <SortableList
            items={rows}
            onReorder={(from, to) => setRows((rs) => reorder(rs, from, to))}
            renderItem={(r, handle) => (
              <div className="card routine-row">
                <div className="exercise-head">
                  <DragHandle handle={handle} label={`Reorder ${r.exercise.name}`} />
                  <ExerciseThumb imagePath={r.exercise.image_path} name={r.exercise.name} size={40} />
                  <strong className="grow">{r.exercise.name}</strong>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Remove ${r.exercise.name}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  >
                    ✕
                  </button>
                </div>
                <div className="row">
                  <label className="field">
                    <span>Sets</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={r.target_sets}
                      onChange={(e) => update(r.id, { target_sets: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label className="field">
                    <span>Rest (s)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={900}
                      step={15}
                      value={r.rest_seconds}
                      onChange={(e) => update(r.id, { rest_seconds: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              </div>
            )}
          />
        </div>

        <button type="button" className="btn" onClick={() => setPicking(true)}>
          + Add exercises
        </button>

        {(save.error || del.error) && (
          <p role="alert" className="error">
            {(save.error ?? del.error)?.message}
          </p>
        )}
        <button className="btn primary" disabled={save.isPending || rows.length === 0}>
          {save.isPending ? 'Saving…' : 'Save routine'}
        </button>
        {initial && (
          <button
            type="button"
            className="btn danger"
            disabled={del.isPending}
            onClick={() =>
              confirm(`Delete routine "${initial.name}"? Past workouts are kept.`) &&
              del.mutate(initial.id, { onSuccess: () => navigate('/') })
            }
          >
            Delete routine
          </button>
        )}
      </form>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(picked) =>
          setRows((rs) => [
            ...rs,
            ...picked.map((exercise) => ({
              id: crypto.randomUUID(),
              exercise,
              target_sets: 3,
              rest_seconds: 90,
            })),
          ])
        }
      />
    </main>
  )
}
