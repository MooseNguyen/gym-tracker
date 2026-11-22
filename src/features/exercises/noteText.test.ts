import { describe, expect, it } from 'vitest'
import { normalizeNote } from './noteText'

describe('normalizeNote', () => {
  it('trims the text', () => {
    expect(normalizeNote('  seat on 4, wide grip \n')).toBe('seat on 4, wide grip')
  })

  it('keeps line breaks inside the note', () => {
    expect(normalizeNote('seat on 4\nwide grip')).toBe('seat on 4\nwide grip')
  })

  it('turns an empty or blank note into null, which deletes it', () => {
    expect(normalizeNote('')).toBeNull()
    expect(normalizeNote(' \n\t ')).toBeNull()
  })
})
