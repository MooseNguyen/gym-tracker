import { useMemo, useState, type ReactNode } from 'react'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { muscleLabel, type Exercise } from '../../types/db'
import { ExerciseFilters } from './ExerciseFilters'
import { filterExercises, NO_FILTERS, toggle, type ExerciseFilters as Filters } from './filters'

interface Props {
  exercises: Exercise[]
  renderAction: (exercise: Exercise) => ReactNode
  /**
   * Shown under the results only (the picker's "Add" bar). On the filter step
   * the Show button owns the bottom of the screen, so the two never stack.
   */
  resultsFooter?: ReactNode
}

/**
 * Find an exercise in two steps, shared by the library page and the picker:
 * 1. pick muscle groups (body map / chips) and/or equipment,
 * 2. browse the matching list.
 * Typing a name skips straight to step 2: searching by name should not cost a tap.
 */
export function ExerciseList({ exercises, renderAction, resultsFooter }: Props) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [step, setStep] = useState<'filter' | 'results'>('filter')

  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])
  const active = [...filters.muscles, ...filters.equipment]
  const hasFilters = active.length > 0

  const removeChip = (value: string) =>
    setFilters((f) =>
      f.muscles.has(value)
        ? { ...f, muscles: toggle(f.muscles, value) }
        : { ...f, equipment: toggle(f.equipment, value) },
    )

  return (
    <div className="stack">
      <input
        type="search"
        placeholder="Search exercises"
        aria-label="Search exercises"
        value={filters.query}
        onChange={(e) => {
          setFilters((f) => ({ ...f, query: e.target.value }))
          if (e.target.value.trim()) setStep('results')
        }}
      />

      {step === 'filter' ? (
        <>
          <ExerciseFilters filters={filters} onChange={setFilters} />
          <div className="row filter-actions">
            {hasFilters && (
              <button
                type="button"
                className="btn"
                onClick={() => setFilters({ ...NO_FILTERS, query: filters.query })}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="btn primary grow"
              disabled={filtered.length === 0}
              onClick={() => setStep('results')}
            >
              {filtered.length === 0
                ? 'No exercises match'
                : hasFilters
                  ? `Show ${filtered.length} exercise${filtered.length === 1 ? '' : 's'}`
                  : `Show all ${filtered.length}`}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="results-bar">
            <button type="button" className="btn small" onClick={() => setStep('filter')}>
              ← Filters
            </button>
            {active.map((v) => (
              <button
                key={v}
                type="button"
                className="chip on small"
                aria-label={`Remove filter ${muscleLabel(v)}`}
                onClick={() => removeChip(v)}
              >
                {muscleLabel(v)} ✕
              </button>
            ))}
            <small className="muted results-count">{filtered.length} found</small>
          </div>
          {filtered.length === 0 ? (
            <p className="muted center">No exercises match. Change the filters or the search.</p>
          ) : (
            <ul className="list">
              {filtered.map((e) => (
                <li key={e.id} className="list-item">
                  <ExerciseThumb imagePath={e.image_path} name={e.name} size={48} />
                  <div className="grow">
                    <div>{e.name}</div>
                    <small className="muted">
                      {muscleLabel(e.muscle_group)} · {e.equipment}
                      {e.user_id && ' · custom'}
                    </small>
                  </div>
                  {renderAction(e)}
                </li>
              ))}
            </ul>
          )}
          {resultsFooter}
        </>
      )}
    </div>
  )
}
