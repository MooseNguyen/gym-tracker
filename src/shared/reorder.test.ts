import { describe, expect, it } from 'vitest'
import { reorder } from './reorder'

const ids = (list: { id: string }[]) => list.map((x) => x.id)
const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }))

describe('reorder', () => {
  it('moves an item down to the target position', () => {
    expect(ids(reorder(list, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item up to the target position', () => {
    expect(ids(reorder(list, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns the same array when dropped on itself or ids are unknown', () => {
    expect(reorder(list, 'b', 'b')).toBe(list)
    expect(reorder(list, 'x', 'b')).toBe(list)
  })

  it('does not mutate the input', () => {
    reorder(list, 'a', 'd')
    expect(ids(list)).toEqual(['a', 'b', 'c', 'd'])
  })
})
