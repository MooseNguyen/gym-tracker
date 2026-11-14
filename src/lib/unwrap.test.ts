import { describe, expect, it } from 'vitest'
import { NetworkError, unwrap } from './unwrap'

describe('unwrap', () => {
  it('returns the data when there is no error', () => {
    expect(unwrap({ data: 'id-1', error: null, status: 200 })).toBe('id-1')
  })

  it('throws a NetworkError when the request got no answer (status 0)', () => {
    const run = () =>
      unwrap({ data: null, error: { message: 'TypeError: Load failed' }, status: 0 })
    expect(run).toThrow(NetworkError)
    expect(run).toThrow('TypeError: Load failed')
  })

  it('throws a plain Error for an answer from the server', () => {
    let caught: unknown
    try {
      unwrap({ data: null, error: { message: 'new row violates row-level security' }, status: 403 })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(NetworkError)
  })

  it('treats a response without a status as an answer from the server', () => {
    expect(() => unwrap({ data: null, error: { message: 'boom' } })).not.toThrow(NetworkError)
  })
})
