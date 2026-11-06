import { useState } from 'react'
import { EQUIPMENT, MUSCLE_GROUPS } from '../../types/db'
import { BodyMap } from './bodyMap/BodyMap'
import { EquipmentIcon } from './EquipmentIcon'
import { toggle, type ExerciseFilters as Filters } from './filters'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
}

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Step 1 of finding an exercise: pick muscle groups and/or equipment. */
export function ExerciseFilters({ filters, onChange }: Props) {
  const [tab, setTab] = useState<'muscles' | 'equipment'>('muscles')
  const [side, setSide] = useState<'front' | 'back'>('front')

  const toggleMuscle = (m: string) => onChange({ ...filters, muscles: toggle(filters.muscles, m) })
  const toggleEquipment = (e: string) =>
    onChange({ ...filters, equipment: toggle(filters.equipment, e) })

  return (
    <div className="stack filters">
      <div className="segmented" role="group" aria-label="Filter by">
        <button
          aria-pressed={tab === 'muscles'}
          className={tab === 'muscles' ? 'on' : ''}
          onClick={() => setTab('muscles')}
        >
          Muscles{filters.muscles.size > 0 && ` (${filters.muscles.size})`}
        </button>
        <button
          aria-pressed={tab === 'equipment'}
          className={tab === 'equipment' ? 'on' : ''}
          onClick={() => setTab('equipment')}
        >
          Equipment{filters.equipment.size > 0 && ` (${filters.equipment.size})`}
        </button>
      </div>

      {tab === 'muscles' ? (
        <div className="muscle-picker">
          <ul className="muscle-chips" aria-label="Muscle groups">
            {MUSCLE_GROUPS.map((m) => {
              const on = filters.muscles.has(m)
              return (
                <li key={m}>
                  <button
                    type="button"
                    className={on ? 'chip on' : 'chip'}
                    aria-pressed={on}
                    onClick={() => toggleMuscle(m)}
                  >
                    <span className="chip-check" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                    {label(m)}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="body-map-wrap">
            <div className="segmented small" role="group" aria-label="Body side">
              <button
                aria-pressed={side === 'front'}
                className={side === 'front' ? 'on' : ''}
                onClick={() => setSide('front')}
              >
                Front
              </button>
              <button
                aria-pressed={side === 'back'}
                className={side === 'back' ? 'on' : ''}
                onClick={() => setSide('back')}
              >
                Back
              </button>
            </div>
            <BodyMap side={side} selected={filters.muscles} onToggle={toggleMuscle} />
          </div>
        </div>
      ) : (
        <ul className="equipment-grid" aria-label="Equipment">
          {EQUIPMENT.map((e) => {
            const on = filters.equipment.has(e)
            return (
              <li key={e}>
                <button
                  type="button"
                  className={on ? 'equipment-tile on' : 'equipment-tile'}
                  aria-pressed={on}
                  onClick={() => toggleEquipment(e)}
                >
                  <EquipmentIcon type={e} />
                  <span>{label(e)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
