import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, MUSCLE_SUBGROUPS, muscleParent, type Exercise } from '../../types/db'
import { BACK, FRONT } from './bodyMap/data'
import {
  activeGroups,
  filterExercises,
  GROUP_REGIONS,
  groupForRegion,
  isAddedInApp,
  NO_FILTERS,
  toggle,
  toggleGroup,
  toggleSubgroup,
} from './filters'

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
const f = (muscles: string[] = [], equipment: string[] = [], query = '', addedInApp = false) => ({
  muscles: new Set(muscles),
  equipment: new Set(equipment),
  addedInApp,
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

describe('added in app filter', () => {
  const mixed: Exercise[] = [
    { ...ex('Bench Press', 'mid-chest', 'barbell'), added_in_app: false },
    { ...ex('Iso Chest Press', 'mid-chest', 'machine'), added_in_app: true },
    { ...ex('Iso Pulldown', 'lats', 'machine'), added_in_app: true },
    { ...ex('My Chest Fly', 'mid-chest', 'cable'), user_id: 'me', added_in_app: true },
  ]

  it('keeps only exercises added in the app (admin built-ins and custom ones)', () => {
    expect(names(filterExercises(mixed, f([], [], '', true)))).toEqual([
      'Iso Chest Press',
      'Iso Pulldown',
      'My Chest Fly',
    ])
  })

  it('combines with muscles, equipment and the name search', () => {
    expect(names(filterExercises(mixed, f(['chest'], [], '', true)))).toEqual([
      'Iso Chest Press',
      'My Chest Fly',
    ])
    expect(names(filterExercises(mixed, f([], ['machine'], 'pull', true)))).toEqual([
      'Iso Pulldown',
    ])
  })

  it('returns nothing when the app has added no exercises', () => {
    expect(filterExercises([mixed[0]], f([], [], '', true))).toEqual([])
  })

  it('falls back to custom exercises for cached data without the column', () => {
    expect(isAddedInApp(ex('Old Built-in', 'lats', 'machine'))).toBe(false)
    expect(isAddedInApp({ ...ex('Old Custom', 'lats', 'machine'), user_id: 'me' })).toBe(true)
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

describe('sub-muscles', () => {
  const back = [
    ex('Lat Pulldown', 'lats', 'cable'),
    ex('Barbell Row', 'upper-back', 'barbell'),
    ex('Barbell Shrug', 'traps', 'barbell'),
    ex('My Old Row', 'back', 'machine'), // custom, created before the split
    ex('Cable Curl', 'biceps', 'cable'),
  ]

  it('knows the parent of every value, plain groups included', () => {
    expect(muscleParent('lats')).toBe('back')
    expect(muscleParent('upper-chest')).toBe('chest')
    expect(muscleParent('rear-delts')).toBe('shoulders')
    expect(muscleParent('back')).toBe('back')
    expect(muscleParent('biceps')).toBe('biceps')
  })

  it('every sub-muscle belongs to exactly one existing group', () => {
    const all = Object.values(MUSCLE_SUBGROUPS).flat()
    expect(new Set(all).size).toBe(all.length)
    for (const g of Object.keys(MUSCLE_SUBGROUPS)) expect(MUSCLE_GROUPS).toContain(g)
  })

  it('a picked group matches its sub-muscles and its legacy plain value', () => {
    expect(names(filterExercises(back, f(['back'])))).toEqual([
      'Lat Pulldown',
      'Barbell Row',
      'Barbell Shrug',
      'My Old Row',
    ])
  })

  it('a picked sub-muscle matches only itself', () => {
    expect(names(filterExercises(back, f(['lats', 'traps'])))).toEqual([
      'Lat Pulldown',
      'Barbell Shrug',
    ])
  })

  it('narrowing a group replaces it; un-picking the last target restores it', () => {
    const picked = toggleSubgroup(new Set(['back', 'biceps']), 'lats')
    expect([...picked].sort()).toEqual(['biceps', 'lats'])
    const both = toggleSubgroup(picked, 'traps')
    expect([...both].sort()).toEqual(['biceps', 'lats', 'traps'])
    expect([...toggleSubgroup(toggleSubgroup(both, 'lats'), 'traps')].sort()).toEqual([
      'back',
      'biceps',
    ])
  })

  it('tapping a group chip clears the group and its targets, or picks it whole', () => {
    expect([...toggleGroup(new Set(['lats', 'traps', 'biceps']), 'back')]).toEqual(['biceps'])
    expect([...toggleGroup(new Set(['biceps']), 'back')]).toEqual(['biceps', 'back'])
    expect([...activeGroups(new Set(['lats', 'mid-chest']))]).toEqual(['back', 'chest'])
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
