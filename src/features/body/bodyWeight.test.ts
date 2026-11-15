import { describe, expect, it } from 'vitest'
import {
  bodyWeightsToCsv,
  change,
  checkWeighIn,
  inRange,
  parseDay,
  type BodyWeight,
} from './bodyWeight'

const log: BodyWeight[] = [
  { measured_on: '2025-06-01', weight_kg: 85 },
  { measured_on: '2026-01-15', weight_kg: 82 },
  { measured_on: '2026-08-14', weight_kg: 81 },
  { measured_on: '2026-08-15', weight_kg: 80.5 },
  { measured_on: '2026-11-14', weight_kg: 79.2 },
]
const today = new Date(2026, 10, 15) // 15 Nov 2026, local

describe('parseDay', () => {
  it('reads the day as a local date, not UTC midnight', () => {
    const d = parseDay('2026-11-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 1, 0])
  })
})

describe('inRange', () => {
  it('3 months back includes the boundary day', () => {
    expect(inRange(log, '3m', today).map((e) => e.measured_on)).toEqual([
      '2026-08-15',
      '2026-11-14',
    ])
  })

  it('1 year and all', () => {
    expect(inRange(log, '1y', today)).toHaveLength(4)
    expect(inRange(log, 'all', today)).toBe(log)
  })
})

describe('change', () => {
  it('last minus first, in kg', () => {
    expect(change(inRange(log, '3m', today))).toBe(-1.3)
  })

  it('needs two weigh-ins', () => {
    expect(change([log[0]])).toBeNull()
    expect(change([])).toBeNull()
  })
})

describe('checkWeighIn', () => {
  it('accepts a comma decimal and keeps the day', () => {
    expect(checkWeighIn('78,4', '2026-11-15', 'kg', '2026-11-15')).toEqual({
      ok: true,
      weight_kg: 78.4,
      measured_on: '2026-11-15',
    })
  })

  it('converts lb to kg, to a value that shows as the same lb again', () => {
    const check = checkWeighIn('176', '2026-11-15', 'lb', '2026-11-15')
    expect(check).toEqual({ ok: true, weight_kg: 79.85, measured_on: '2026-11-15' })
  })

  it('refuses a typo outside the bounds, in the account unit', () => {
    expect(checkWeighIn('7.8', '2026-11-15', 'kg', '2026-11-15')).toMatchObject({
      ok: false,
      field: 'weight',
      message: 'Enter a weight between 20 and 400 kg.',
    })
    expect(checkWeighIn('900', '2026-11-15', 'lb', '2026-11-15')).toMatchObject({
      ok: false,
      message: 'Enter a weight between 45 and 881 lb.',
    })
    expect(checkWeighIn('', '2026-11-15', 'kg', '2026-11-15')).toMatchObject({ ok: false })
    // The message's bounds are the real ones: 44.5 lb is under "45".
    expect(checkWeighIn('44.5', '2026-11-15', 'lb', '2026-11-15')).toMatchObject({ ok: false })
    expect(checkWeighIn('45', '2026-11-15', 'lb', '2026-11-15')).toMatchObject({ ok: true })
  })

  it('refuses a day in the future or no day', () => {
    expect(checkWeighIn('80', '2026-11-16', 'kg', '2026-11-15')).toMatchObject({
      ok: false,
      field: 'date',
    })
    expect(checkWeighIn('80', '', 'kg', '2026-11-15')).toMatchObject({ ok: false, field: 'date' })
  })
})

describe('bodyWeightsToCsv', () => {
  it('oldest first, in the account unit, with a BOM and CRLF', () => {
    const csv = bodyWeightsToCsv([log[4], log[3]], 'lb')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('Date,Weight (lb)\r\n2026-08-15,177.5\r\n2026-11-14,174.6\r\n')
  })
})
