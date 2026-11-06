import { useState } from 'react'
import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_SUBGROUPS, muscleLabel } from '../../types/db'
import { BodyMap } from './bodyMap/BodyMap'
import { EquipmentIcon } from './EquipmentIcon'
import {
  activeGroups,
  toggle,
  toggleGroup,
  toggleSubgroup,
  type ExerciseFilters as Filters,
} from './filters'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
}

const label = (s: string) => {
  const l = muscleLabel(s)
  return l.charAt(0).toUpperCase() + l.slice(1)
}

/** Step 1 of finding an exercise: pick muscle groups and/or equipment. */
export function ExerciseFilters({ filters, onChange }: Props) {
  const [tab, setTab] = useState<'muscles' | 'equipment'>('muscles')
  const [side, setSide] = useState<'front' | 'back'>('front')

  const groups = activeGroups(filters.muscles)
  const toggleMuscle = (m: string) =>
    onChange({ ...filters, muscles: toggleGroup(filters.muscles, m) })
  const toggleSub = (s: string) =>
    onChange({ ...filters, muscles: toggleSubgroup(filters.muscles, s) })
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
              const on = groups.has(m)
              const subs = MUSCLE_SUBGROUPS[m]
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
                  {/* Picked group with targets: narrow it right under its chip.
                      None picked = the whole group. */}
                  {on && subs && (
                    <ul className="sub-chips" aria-label={`${label(m)} targets`}>
                      {subs.map((s) => {
                        const subOn = filters.muscles.has(s)
                        return (
                          <li key={s}>
                            <button
                              type="button"
                              className={subOn ? 'chip small on' : 'chip small'}
                              aria-pressed={subOn}
                              onClick={() => toggleSub(s)}
                            >
                              {label(s)}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
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
            <BodyMap side={side} selected={groups} onToggle={toggleMuscle} />
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
