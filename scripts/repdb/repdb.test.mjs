import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, MUSCLE_SUBGROUPS } from '../../src/types/db'
import {
  equipmentFor,
  excluded,
  kindFor,
  muscleFor,
  offByDefault,
  SECONDARY_MUSCLE,
  secondaryFor,
} from './repdb.mjs'

const ex = (over) => ({
  id: 'x',
  name_en: 'X',
  category: 'strength',
  equipment: [],
  primary_muscles: ['quadriceps'],
  is_bodyweight: false,
  ...over,
})

describe('muscleFor', () => {
  it('splits the chest by angle, with push-ups inverted', () => {
    const chest = (name) => muscleFor(ex({ name_en: name, primary_muscles: ['pectoralis_major'] }))
    expect(chest('Incline Dumbbell Press')).toBe('upper-chest')
    expect(chest('Decline Bench Press')).toBe('lower-chest')
    expect(chest('Chest Dips')).toBe('lower-chest')
    expect(chest('Decline Push-Up')).toBe('upper-chest')
    expect(chest('Incline Push-Up')).toBe('lower-chest')
    expect(chest('Cable Fly')).toBe('mid-chest')
  })

  it('files lats work by movement, traps by shrugs', () => {
    const lats = (name) => muscleFor(ex({ name_en: name, primary_muscles: ['latissimus_dorsi'] }))
    expect(lats('Pendlay Row')).toBe('upper-back')
    expect(lats('One-Arm Seated Cable Row')).toBe('lats')
    expect(lats('Lat Pulldown')).toBe('lats')
    expect(muscleFor(ex({ name_en: 'Kettlebell Shrug', primary_muscles: ['trapezius'] }))).toBe(
      'traps',
    )
  })

  it('files glute-led lifts the way lifters do', () => {
    const glutes = (name) => muscleFor(ex({ name_en: name, primary_muscles: ['gluteus_maximus'] }))
    expect(glutes('Barbell Back Squat')).toBe('quads')
    expect(glutes('Dumbbell Romanian Deadlift')).toBe('hamstrings')
    expect(glutes('Barbell Hip Thrust')).toBe('glutes')
    expect(
      muscleFor(ex({ name_en: 'Wide-Stance Leg Press', primary_muscles: ['adductors'] })),
    ).toBe('quads')
  })

  it('sends cardio to cardio and refuses unknown muscles', () => {
    expect(muscleFor(ex({ category: 'cardio', primary_muscles: ['gastrocnemius'] }))).toBe('cardio')
    expect(() => muscleFor(ex({ primary_muscles: ['spleen'] }))).toThrow(/No muscle mapping/)
  })
})

describe('equipmentFor', () => {
  it('lets the free weight win over the bench', () => {
    expect(equipmentFor(ex({ equipment: ['flat_bench', 'dumbbell'] }))).toBe('dumbbell')
    expect(equipmentFor(ex({ equipment: ['ez_bar'] }))).toBe('barbell')
  })

  it('groups machines, bands, bodyweight stations and the rest', () => {
    expect(equipmentFor(ex({ equipment: ['smith_machine'] }))).toBe('machine')
    expect(equipmentFor(ex({ equipment: ['plate_loaded_lateral_raise_machine'] }))).toBe('machine')
    expect(equipmentFor(ex({ equipment: ['loop_band'] }))).toBe('band')
    expect(equipmentFor(ex({ equipment: ['pull_up_bar'] }))).toBe('bodyweight')
    expect(equipmentFor(ex({ equipment: [] }))).toBe('bodyweight')
    expect(equipmentFor(ex({ equipment: ['sled'] }))).toBe('other')
  })
})

describe('kindFor', () => {
  it('times cardio and static holds, not moves that merely mention them', () => {
    expect(kindFor(ex({ category: 'cardio' }))).toBe('duration')
    expect(kindFor(ex({ name_en: 'Hollow Body Hold' }))).toBe('duration')
    expect(kindFor(ex({ name_en: 'Copenhagen Plank' }))).toBe('duration')
    expect(kindFor(ex({ name_en: 'Hang Power Clean', equipment: ['barbell'] }))).toBe('weight_reps')
    expect(kindFor(ex({ name_en: 'Plank Knee Tuck' }))).toBe('bodyweight_reps')
    expect(kindFor(ex({ name_en: 'Dragon Flag' }))).toBe('bodyweight_reps')
  })

  it('logs reps only when there is nothing to weigh', () => {
    expect(kindFor(ex({ name_en: 'Banded Clamshell', equipment: ['loop_band'] }))).toBe(
      'bodyweight_reps',
    )
    expect(kindFor(ex({ name_en: 'Barbell Curl', equipment: ['barbell'] }))).toBe('weight_reps')
    expect(kindFor(ex({ name_en: 'Dumbbell Farmer’s Walk', equipment: ['dumbbell'] }))).toBe(
      'weight_reps',
    )
  })
})

describe('excluded / offByDefault', () => {
  it('drops stretches and ball work, unticks yoga and hold twins', () => {
    expect(excluded(ex({ category: 'stretching' }))).toBe('stretching')
    expect(excluded(ex({ equipment: ['bosu_ball'] }))).toBe('ball')
    expect(offByDefault(ex({ id: 'tree-pose', name_en: 'Tree Pose' }))).toBe('yoga')
    expect(offByDefault(ex({ id: 'glute-bridge-hold', name_en: 'Glute Bridge Hold' }))).toBe(
      'hold variant',
    )
    expect(offByDefault(ex({ id: 'hollow-body-hold', name_en: 'Hollow Body Hold' }))).toBeNull()
  })
})

describe('scripts/repdb/old-to-repdb.json', () => {
  const map = JSON.parse(readFileSync(new URL('./old-to-repdb.json', import.meta.url), 'utf8'))
  delete map._note

  it('never sends two old exercises to the same RepDB id', () => {
    const ids = Object.values(map).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('secondaryFor', () => {
  it('maps RepDB muscles to app muscles, once each, in order', () => {
    const e = {
      id: 'x',
      secondary_muscles: [
        'anterior_deltoid',
        'triceps_brachii',
        'lateral_deltoid',
        'supraspinatus',
      ],
    }
    expect(secondaryFor(e)).toEqual(['front-delts', 'triceps', 'side-delts'])
  })

  it('drops muscles the app has no group for', () => {
    expect(secondaryFor({ id: 'x', secondary_muscles: ['serratus_anterior', 'obliques'] })).toEqual(
      ['core'],
    )
  })

  it('fails loudly on a muscle it does not know', () => {
    expect(() => secondaryFor({ id: 'x', secondary_muscles: ['spleen'] })).toThrow(/spleen/)
  })

  it('only produces values the app knows', () => {
    const known = new Set([...MUSCLE_GROUPS, ...Object.values(MUSCLE_SUBGROUPS).flat()])
    for (const m of Object.values(SECONDARY_MUSCLE)) if (m) expect(known.has(m), m).toBe(true)
  })
})
