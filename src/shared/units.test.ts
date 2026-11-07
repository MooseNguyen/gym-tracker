import { describe, expect, it } from 'vitest'
import { formatAmount, fromKg, toKg } from './units'

describe('kg ↔ lb', () => {
  it('kg passes through untouched', () => {
    expect(fromKg(82.5, 'kg')).toBe(82.5)
    expect(toKg(82.5, 'kg')).toBe(82.5)
  })

  it('converts with the usual rounding', () => {
    expect(toKg(135, 'lb')).toBe(61.25) // the roundest kg that still reads 135 lb
    expect(toKg(220.5, 'lb')).toBe(100) // not 100.02
    expect(fromKg(100, 'lb')).toBe(220.5)
    expect(fromKg(20, 'lb')).toBe(44.1) // a 20 kg bar is not a 45 lb bar
  })

  it('every lb value typed with one decimal comes back exactly after saving', () => {
    // What the lifter typed → stored kg → shown again. 0 to 1000 lb by 0.1.
    for (let tenths = 0; tenths <= 10000; tenths++) {
      const lb = tenths / 10
      expect(fromKg(toKg(lb, 'lb'), 'lb')).toBe(lb)
    }
  })
})

describe('a kg log seen and saved from an lb screen', () => {
  it('keeps every usual kg weight exactly, so no false PR appears', () => {
    // Multiples of 0.25 kg up to 500 kg: shown in lb, saved back unchanged.
    for (let quarters = 0; quarters <= 2000; quarters++) {
      const kg = quarters / 4
      expect(toKg(fromKg(kg, 'lb'), 'lb')).toBe(kg)
    }
  })
})

describe('formatAmount', () => {
  it('groups thousands and keeps one decimal', () => {
    expect(formatAmount(1120, 'lb')).toMatch(/^1.120 lb$/) // separator depends on locale
    expect(formatAmount(101.25, 'kg')).toMatch(/^101.3 kg$/)
  })
})
