// Tiny helpers for writing SQL literals from scripts. Kept separate so they can
// be unit tested: a wrong escape here would break the migration or, worse,
// let text from a third-party dataset change the SQL.

/** Single-quoted SQL string literal. Doubling ' is the standard SQL escape. */
export function sqlString(value) {
  if (typeof value !== 'string') throw new TypeError('sqlString expects a string')
  // NUL bytes are not allowed in Postgres text; drop them rather than fail.
  return `'${value.replaceAll('\0', '').replaceAll("'", "''")}'`
}

/** Postgres text[] literal, e.g. ARRAY['a','b']::text[]. Empty → '{}'::text[]. */
export function sqlTextArray(values) {
  if (values.length === 0) return `'{}'::text[]`
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`
}
