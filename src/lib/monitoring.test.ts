import { describe, expect, it } from 'vitest'
import { isReportable } from './monitoring'
import { NetworkError } from './unwrap'

describe('isReportable', () => {
  it('skips a request that got no answer', () => {
    expect(isReportable(new NetworkError('TypeError: Load failed'))).toBe(false)
  })

  it('skips cancelled and timed-out requests', () => {
    expect(isReportable(new DOMException('The operation was aborted.', 'AbortError'))).toBe(false)
    expect(isReportable(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(false)
  })

  it('reports bugs and answers from the server', () => {
    expect(isReportable(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(
      true,
    )
    expect(isReportable(new Error('new row violates row-level security policy'))).toBe(true)
  })

  it('reports values thrown that are not errors', () => {
    expect(isReportable('something odd')).toBe(true)
  })
})
