import { describe, expect, it } from 'vitest'
import type { Routine } from '../../types/db'
import { duplicateName, duplicatePayload, routineShareText } from './routineActions'

const exercise = (id: string, name: string) => ({
  id,
  user_id: null,
  name,
  muscle_group: 'mid-chest',
  equipment: 'barbell',
  kind: 'weight_reps' as const,
  image_path: null,
})

const push: Routine = {
  id: 'r1',
  name: 'Push',
  notes: 'Heavy day',
  folder_id: 'f1',
  created_at: '2026-11-01',
  routine_exercises: [
    {
      id: 're1',
      exercise_id: 'e1',
      position: 0,
      target_sets: 4,
      rest_seconds: 150,
      exercise: exercise('e1', 'Bench Press'),
    },
    {
      id: 're2',
      exercise_id: 'e2',
      position: 1,
      target_sets: 1,
      rest_seconds: 60,
      exercise: exercise('e2', 'Pec Deck'),
    },
  ],
}

describe('duplicateName', () => {
  it('adds "(copy)", then numbers further copies', () => {
    expect(duplicateName('Push', ['Push'])).toBe('Push (copy)')
    expect(duplicateName('Push', ['Push', 'Push (copy)'])).toBe('Push (copy 2)')
    expect(duplicateName('Push', ['Push', 'Push (copy)', 'Push (copy 2)'])).toBe('Push (copy 3)')
  })

  it('copying a copy keeps a single suffix', () => {
    expect(duplicateName('Push (copy)', ['Push', 'Push (copy)'])).toBe('Push (copy 2)')
    expect(duplicateName('Push (copy 2)', ['Push (copy)', 'Push (copy 2)'])).toBe('Push (copy 3)')
  })
})

describe('duplicatePayload', () => {
  it('keeps folder, notes, order, sets and rest, without an id', () => {
    expect(duplicatePayload(push, 'Push (copy)')).toEqual({
      name: 'Push (copy)',
      notes: 'Heavy day',
      folder_id: 'f1',
      exercises: [
        { exercise_id: 'e1', target_sets: 4, rest_seconds: 150 },
        { exercise_id: 'e2', target_sets: 1, rest_seconds: 60 },
      ],
    })
  })
})

describe('routineShareText', () => {
  it('lists the exercises with their sets', () => {
    expect(routineShareText(push)).toBe(
      'Push\nHeavy day\n\n1. Bench Press — 4 sets\n2. Pec Deck — 1 set',
    )
  })

  it('skips empty notes', () => {
    expect(routineShareText({ ...push, notes: null }).split('\n')[1]).toBe('')
  })
})
