import { useMemo, useState, type ReactNode } from 'react'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { MUSCLE_GROUPS, type Exercise } from '../../types/db'

interface Props {
  exercises: Exercise[]
  renderAction: (exercise: Exercise) => ReactNode
}

/** Searchable, filterable exercise list shared by the library page and the picker. */
export function ExerciseList({ exercises, renderAction }: Props) {
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(
      (e) => (!muscle || e.muscle_group === muscle) && (!q || e.name.toLowerCase().includes(q)),
    )
  }, [exercises, search, muscle])

  return (
    <div className="stack">
      <div className="row">
        <input
          type="search"
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Muscle group"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">All muscles</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="muted center">No exercises match.</p>
      ) : (
        <ul className="list">
          {filtered.map((e) => (
            <li key={e.id} className="list-item">
              <ExerciseThumb imagePath={e.image_path} name={e.name} size={48} />
              <div className="grow">
                <div>{e.name}</div>
                <small className="muted">
                  {e.muscle_group} · {e.equipment}
                  {e.user_id && ' · custom'}
                </small>
              </div>
              {renderAction(e)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
