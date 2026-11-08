// Shared helpers for backup.mjs and restore.mjs: run psql / pg_dump and fail
// loudly. No npm dependency: the PostgreSQL client tools do the work.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const BUCKET = 'exercise-images'

/**
 * Call first in a script. Its errors are for the person running it (missing
 * variable, failed dump, wrong folder): the message is what they need, a
 * stack trace is noise. DEBUG=1 prints the stack too.
 */
export function printErrorsPlainly() {
  process.on('uncaughtException', (error) => {
    console.error(`\nError: ${error.message}`)
    if (process.env.DEBUG) console.error(error.stack)
    process.exit(1)
  })
}

export function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} (see docs/BACKUP.md)`)
  return value
}

// PG_BIN, then PATH, then scoop's folder (`scoop install postgresql` adds no
// shim for pg_dump / psql).
function tool(name) {
  if (process.env.PG_BIN) return join(process.env.PG_BIN, name)
  if (spawnSync(name, ['--version']).status === 0) return name
  const scoop = join(homedir(), 'scoop', 'apps', 'postgresql', 'current', 'bin', `${name}.exe`)
  if (existsSync(scoop)) return scoop
  throw new Error(`${name} not found: install PostgreSQL client tools or set PG_BIN`)
}

/** Runs a PostgreSQL tool, output to the terminal; throws on a non-zero exit. */
export function pg(name, args, options = {}) {
  const result = spawnSync(tool(name), args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status}`)
}

/** Runs one query with psql and returns its rows as "a|b" lines. */
export function query(dbUrl, sql) {
  const result = spawnSync(
    tool('psql'),
    ['-d', dbUrl, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      encoding: 'utf8',
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`psql: ${result.stderr.trim()}`)
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

/** Public URL of a photo; the bucket is public, so no key is needed to read. */
export const photoUrl = (projectUrl, path) =>
  `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
