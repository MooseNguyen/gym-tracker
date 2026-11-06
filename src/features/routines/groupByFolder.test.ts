import { describe, expect, it } from 'vitest'
import type { Routine, RoutineFolder } from '../../types/db'
import { groupByFolder } from './api'

const folder = (id: string): RoutineFolder => ({ id, name: id, created_at: '2026-01-01' })
const routine = (id: string, folder_id: string | null): Routine => ({
  id,
  name: id,
  notes: null,
  folder_id,
  created_at: '2026-01-01',
  routine_exercises: [],
})

describe('groupByFolder', () => {
  it('puts routines under their folder in folder order, unfiled last', () => {
    const groups = groupByFolder(
      [folder('ppl'), folder('upper-lower')],
      [
        routine('push', 'ppl'),
        routine('upper', 'upper-lower'),
        routine('cardio', null),
        routine('pull', 'ppl'),
      ],
    )
    expect(groups.map((g) => [g.folder?.id ?? null, g.routines.map((r) => r.id)])).toEqual([
      ['ppl', ['push', 'pull']],
      ['upper-lower', ['upper']],
      [null, ['cardio']],
    ])
  })

  it('keeps empty folders and omits an empty unfiled group', () => {
    const groups = groupByFolder([folder('new')], [])
    expect(groups).toEqual([{ folder: folder('new'), routines: [] }])
  })

  it('treats a routine whose folder no longer exists as unfiled', () => {
    const groups = groupByFolder([], [routine('orphan', 'deleted-folder')])
    expect(groups).toEqual([{ folder: null, routines: [routine('orphan', 'deleted-folder')] }])
  })
})
