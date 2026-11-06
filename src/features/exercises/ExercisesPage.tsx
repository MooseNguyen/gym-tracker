import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useConfirm } from '../../shared/ui/confirmContext'
import { Dialog } from '../../shared/ui/Dialog'
import { QueryState } from '../../shared/ui/QueryState'
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  MUSCLE_SUBGROUPS,
  muscleLabel,
  type ExerciseKind,
} from '../../types/db'
import { useCreateExercise, useDeleteExercise, useExercises } from './api'
import { ExerciseList } from './ExerciseList'
import { HowToButton } from './HowTo'

export function ExercisesPage() {
  const { data = [], isPending, error, refetch } = useExercises()
  const del = useDeleteExercise()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)

  return (
    <main className="page">
      <div className="row between">
        <h1>Exercises</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>
          + New
        </button>
      </div>
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
                <HowToButton exercise={{ id: e.id, name: e.name, imagePath: e.image_path }} />
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
                    if (ok) del.mutate(e.id)
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          )}
        />
      </QueryState>
      <Dialog open={adding} onClose={() => setAdding(false)} title="New exercise">
        <NewExerciseForm onDone={() => setAdding(false)} />
      </Dialog>
    </main>
  )
}

function NewExerciseForm({ onDone }: { onDone: () => void }) {
  const create = useCreateExercise()
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<string>(MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState<string>(EQUIPMENT[0])
  const [kind, setKind] = useState<ExerciseKind>('weight_reps')

  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      { name: name.trim(), muscle_group: muscle, equipment, kind },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Muscle group</span>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {MUSCLE_GROUPS.map((m) => {
            const subs = MUSCLE_SUBGROUPS[m]
            if (!subs) return <option key={m}>{m}</option>
            return (
              <optgroup key={m} label={m}>
                <option value={m}>{m} (general)</option>
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {muscleLabel(s)}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </label>
      <label className="field">
        <span>Equipment</span>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          {EQUIPMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tracked as</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
          <option value="weight_reps">Weight × reps</option>
          <option value="bodyweight_reps">Reps only</option>
          <option value="duration">Duration</option>
        </select>
      </label>
      {create.error && (
        <p role="alert" className="error">
          {create.error.message}
        </p>
      )}
      <button className="btn primary" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
