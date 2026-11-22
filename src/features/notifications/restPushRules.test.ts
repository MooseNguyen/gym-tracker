import { describe, expect, it } from 'vitest'
import { alertWrite, base64UrlToBytes, pushSupport } from './restPushRules'

describe('pushSupport', () => {
  const env = { hasKey: true, hasPushApi: true, isIos: false, standalone: false }

  it('is available where the browser has the Push API', () => {
    expect(pushSupport(env)).toBe('available')
  })

  it('asks iPhone users to add the app to the Home Screen first', () => {
    expect(pushSupport({ ...env, isIos: true, hasPushApi: false })).toBe('install-first')
    expect(pushSupport({ ...env, isIos: true, standalone: true })).toBe('available')
  })

  it('is unsupported without the Push API or without a VAPID key', () => {
    expect(pushSupport({ ...env, hasPushApi: false })).toBe('unsupported')
    expect(pushSupport({ ...env, hasKey: false })).toBe('unsupported')
  })
})

describe('alertWrite', () => {
  const now = Date.parse('2026-11-23T10:00:00Z')

  it('saves a new or changed rest end that is still ahead', () => {
    expect(alertWrite(null, now + 90_000, now)).toEqual({
      kind: 'save',
      fireAt: '2026-11-23T10:01:30.000Z',
    })
    expect(alertWrite(now + 90_000, now + 105_000, now)).toMatchObject({ kind: 'save' })
  })

  it('saves a running rest again when the app opens, and writes nothing without one', () => {
    expect(alertWrite(undefined, now + 30_000, now)).toMatchObject({ kind: 'save' })
    expect(alertWrite(undefined, null, now)).toBeNull()
  })

  it('clears the alert on Skip, or when −15 moves the end into the past', () => {
    expect(alertWrite(now + 30_000, null, now)).toEqual({ kind: 'clear' })
    expect(alertWrite(now + 10_000, now - 5_000, now)).toEqual({ kind: 'clear' })
  })

  it('does nothing when the rest end did not change', () => {
    expect(alertWrite(now + 30_000, now + 30_000, now)).toBeNull()
    expect(alertWrite(null, null, now)).toBeNull()
  })
})

describe('base64UrlToBytes', () => {
  it('decodes base64url without padding', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })
})
