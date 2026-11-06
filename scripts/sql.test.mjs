import { describe, expect, it } from 'vitest'
import { sqlString, sqlTextArray } from './sql.mjs'

describe('sqlString', () => {
  it('wraps in single quotes', () => {
    expect(sqlString('Bench Press')).toBe("'Bench Press'")
  })

  it("doubles single quotes, so a ' cannot end the literal", () => {
    expect(sqlString("Don't lock your elbows")).toBe("'Don''t lock your elbows'")
    expect(sqlString("'); drop table exercises; --")).toBe("'''); drop table exercises; --'")
  })

  it('keeps backslashes and double quotes as they are (standard_conforming_strings)', () => {
    expect(sqlString('a\\b "c"')).toBe(`'a\\b "c"'`)
  })

  it('drops NUL bytes, which Postgres text cannot store', () => {
    expect(sqlString('a\0b')).toBe("'ab'")
  })

  it('rejects non-strings', () => {
    expect(() => sqlString(null)).toThrow(TypeError)
  })
})

describe('sqlTextArray', () => {
  it('builds a typed text[] literal', () => {
    expect(sqlTextArray(['Step 1', "It's step 2"])).toBe("ARRAY['Step 1', 'It''s step 2']::text[]")
  })

  it('handles an empty list (ARRAY[] needs a type, so use the {} form)', () => {
    expect(sqlTextArray([])).toBe("'{}'::text[]")
  })
})
