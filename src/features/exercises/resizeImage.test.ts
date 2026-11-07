import { describe, expect, it } from 'vitest'
import { centerSquare } from './resizeImage'

describe('centerSquare', () => {
  it('crops the middle of a portrait phone photo', () => {
    expect(centerSquare(3024, 4032)).toEqual({ sx: 0, sy: 504, side: 3024 })
  })

  it('crops the middle of a landscape photo', () => {
    expect(centerSquare(1600, 900)).toEqual({ sx: 350, sy: 0, side: 900 })
  })

  it('keeps a square image whole', () => {
    expect(centerSquare(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 })
  })
})
