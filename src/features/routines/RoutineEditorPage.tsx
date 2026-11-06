import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { QueryState } from '../../shared/ui/QueryState'
import type { Exercise, Routine } from '../../types/db'
import { useDeleteRoutine, useRoutine, useSaveRoutine } from './api'

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
  key: string
  exercise: Exercise
  target_sets: number
  rest_seconds: number
}

function RoutineForm({ initial }: { initial?: Routine }) {
  const navigate = useNavigate()
  const save = useSaveRoutine()
  const del = useDeleteRoutine()
  const [name, setName] = useState(initial?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [rows, setRows] = useState<Row[]>(
    initial?.routine_exercises.map((re) => ({
      key: re.id,
      exercise: re.exercise,
      target_sets: re.target_sets,
      rest_seconds: re.rest_seconds,
    })) ?? [],
  )
  const [picking, setPicking] = useState(false)

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const move = (index: number, dir: -1 | 1) =>
    setRows((rs) => {
      const target = index + dir
      if (target < 0 || target >= rs.length) return rs
      const next = [...rs]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      {
        id: initial?.id,
        name: name.trim(),
        notes: notes.trim() || null,
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
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {rows.length === 0 && <p className="muted center">No exercises yet.</p>}
        <ol className="list">
          {rows.map((r, i) => (
            <li key={r.key} className="card stack">
              <div className="row between">
                <strong>{r.exercise.name}</strong>
                <div className="row">
                  <button
                    type="button"
                    className="btn small"
                    aria-label="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    aria-label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    aria-label={`Remove ${r.exercise.name}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    ✕
                  </button>
                </div>
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
                    onChange={(e) => update(r.key, { target_sets: Number(e.target.value) || 1 })}
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
                    onChange={(e) => update(r.key, { rest_seconds: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
            </li>
          ))}
        </ol>

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
              key: crypto.randomUUID(),
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
