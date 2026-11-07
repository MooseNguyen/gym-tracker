import { describe, expect, it } from 'vitest'
import { platesPerSide } from './plates'

describe('platesPerSide', () => {
  it('loads the heaviest plates first', () => {
    expect(platesPerSide(100, 20)).toEqual({ perSide: [25, 15], leftOver: 0, belowBar: false })
  })

  it('uses the small change plates without floating-point drift', () => {
    expect(platesPerSide(82.5, 20).perSide).toEqual([25, 5, 1.25])
    expect(platesPerSide(82.5, 20).leftOver).toBe(0)
  })

  it('is just the bar at bar weight', () => {
    expect(platesPerSide(20, 20)).toEqual({ perSide: [], leftOver: 0, belowBar: false })
  })

  it('says what cannot be loaded with the plates there are', () => {
    // 21 kg on a 20 kg bar: 0.5 kg a side, smaller than any plate.
    expect(platesPerSide(21, 20)).toEqual({ perSide: [], leftOver: 1, belowBar: false })
    expect(platesPerSide(63, 20)).toEqual({ perSide: [20, 1.25], leftOver: 0.5, belowBar: false })
  })

  it('flags a target lighter than the bar', () => {
    expect(platesPerSide(15, 20)).toEqual({ perSide: [], leftOver: 0, belowBar: true })
  })

  it('works with another bar and plate set', () => {
    expect(platesPerSide(135, 45, [45, 35, 25, 10, 5, 2.5]).perSide).toEqual([45])
  })
})
