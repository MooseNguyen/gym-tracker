import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, type Exercise } from '../../types/db'
import { BACK, FRONT } from './bodyMap/data'
import { filterExercises, GROUP_REGIONS, groupForRegion, NO_FILTERS, toggle } from './filters'

const ex = (name: string, muscle_group: string, equipment: string): Exercise => ({
  id: name,
  user_id: null,
  name,
  muscle_group,
  equipment,
  kind: 'weight_reps',
  image_path: null,
})

const library = [
  ex('Bench Press', 'chest', 'barbell'),
  ex('Pec Deck', 'chest', 'machine'),
  ex('Lateral Raise', 'shoulders', 'dumbbell'),
  ex('Machine Shoulder Press', 'shoulders', 'machine'),
  ex('Cable Curl', 'biceps', 'cable'),
]
const names = (list: Exercise[]) => list.map((e) => e.name)
const f = (muscles: string[] = [], equipment: string[] = [], query = '') => ({
  muscles: new Set(muscles),
  equipment: new Set(equipment),
  query,
})

describe('filterExercises', () => {
  it('returns everything with no filters', () => {
    expect(filterExercises(library, NO_FILTERS)).toHaveLength(5)
  })

  it('matches ANY of the picked muscles', () => {
    expect(names(filterExercises(library, f(['chest', 'biceps'])))).toEqual([
      'Bench Press',
      'Pec Deck',
      'Cable Curl',
    ])
  })

  it('matches ANY of the picked equipment', () => {
    expect(names(filterExercises(library, f([], ['machine', 'cable'])))).toEqual([
      'Pec Deck',
      'Machine Shoulder Press',
      'Cable Curl',
    ])
  })

  it('requires BOTH a muscle and an equipment match when both are picked', () => {
    expect(names(filterExercises(library, f(['chest', 'shoulders'], ['machine'])))).toEqual([
      'Pec Deck',
      'Machine Shoulder Press',
    ])
  })

  it('combines with a case-insensitive name search', () => {
    expect(names(filterExercises(library, f(['shoulders'], [], '  PRESS ')))).toEqual([
      'Machine Shoulder Press',
    ])
  })

  it('returns nothing when no exercise matches', () => {
    expect(filterExercises(library, f(['calves'], ['barbell']))).toEqual([])
  })
})

describe('body map mapping', () => {
  it('maps every muscle group of the app (cardio has no region)', () => {
    expect(Object.keys(GROUP_REGIONS).sort()).toEqual([...MUSCLE_GROUPS].sort())
    expect(GROUP_REGIONS.cardio).toEqual([])
  })

  it('only refers to regions that exist in the drawing', () => {
    const drawn = new Set([...FRONT, ...BACK].map((r) => r.muscle))
    for (const parts of Object.values(GROUP_REGIONS)) {
      for (const p of parts) expect(drawn.has(p), p).toBe(true)
    }
  })

  it('finds the group of a tapped region, null for decorative parts', () => {
    expect(groupForRegion('front-deltoids')).toBe('shoulders')
    expect(groupForRegion('upper-back')).toBe('back')
    expect(groupForRegion('left-soleus')).toBe('calves')
    expect(groupForRegion('head')).toBeNull()
    expect(groupForRegion('knees')).toBeNull()
  })
})

describe('toggle', () => {
  it('adds and removes without mutating the input', () => {
    const a = new Set(['chest'])
    const b = toggle(a, 'back')
    expect([...b]).toEqual(['chest', 'back'])
    expect([...toggle(b, 'chest')]).toEqual(['back'])
    expect([...a]).toEqual(['chest'])
  })
})
