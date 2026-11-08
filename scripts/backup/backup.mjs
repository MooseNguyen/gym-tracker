// Monthly backup of the production data: every table, the accounts (with
// password hashes and the admin role) and the uploaded exercise photos.
//
//   npm run backup
//
// Reads BACKUP_DB_URL (and optional BACKUP_DIR) from .env.backup and
// VITE_SUPABASE_URL from .env.local. See docs/BACKUP.md.
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, pg, photoUrl, printErrorsPlainly, query, BUCKET } from './pg.mjs'

printErrorsPlainly()
const here = dirname(fileURLToPath(import.meta.url))
const db = env('BACKUP_DB_URL')
const projectUrl = env('VITE_SUPABASE_URL')
const root = process.env.BACKUP_DIR || join(homedir(), 'gym-tracker-backups')

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

mkdirSync(root, { recursive: true })
const done = readdirSync(root)
  .filter((name) => /^\d{4}-\d{2}-\d{2}(_\d{4})?$/.test(name))
  .sort()
if (done.length) {
  const days = Math.round((now - new Date(done.at(-1).slice(0, 10))) / 86_400_000)
  console.log(`Previous backup: ${done.at(-1)} (${days} days ago)`)
}

const name = done.includes(today)
  ? `${today}_${pad(now.getHours())}${pad(now.getMinutes())}`
  : today
// Written under .partial and renamed at the end: a folder without the suffix
// is always a complete backup.
const dir = join(root, `${name}.partial`)
mkdirSync(join(dir, 'images'), { recursive: true })
console.log(`Backing up to ${join(root, name)}`)

// Data only: the schema comes from supabase/migrations on restore. COPY with
// column lists, so a newer auth schema with extra columns still loads it.
// Two runs because pg_dump ignores --schema when --table is given.
const dump = ['--data-only', '--no-owner', '--no-privileges']
pg('pg_dump', ['-d', db, ...dump, '--schema=public', '-f', join(dir, 'public-data.sql')])
pg('pg_dump', [
  '-d',
  db,
  ...dump,
  '--table=auth.users',
  '--table=auth.identities',
  '-f',
  join(dir, 'auth-data.sql'),
])
// For reference only: shows what the production schema looked like that day.
pg('pg_dump', [
  '-d',
  db,
  '--schema-only',
  '--no-owner',
  '--schema=public',
  '-f',
  join(dir, 'public-schema.sql'),
])
pg('psql', [
  '-d',
  db,
  '-X',
  '-At',
  '-v',
  'ON_ERROR_STOP=1',
  '-f',
  join(here, 'counts.sql'),
  '-o',
  join(dir, 'counts.txt'),
])

// Photos: the paths come from storage.objects, the bytes from the public URL,
// so the backup needs no service key.
const photos = query(
  db,
  `select name from storage.objects where bucket_id = '${BUCKET}' order by name`,
)
for (const [i, path] of photos.entries()) {
  // fetch's own message is just "fetch failed"; the reason is in its cause.
  const response = await fetch(photoUrl(projectUrl, path)).catch((error) => {
    throw new Error(`photo ${path}: ${error.cause?.message ?? error.message}`)
  })
  if (!response.ok) throw new Error(`photo ${path}: HTTP ${response.status}`)
  const file = join(dir, 'images', ...path.split('/'))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  console.log(`  photo ${i + 1}/${photos.length} ${path}`)
}
writeFileSync(join(dir, 'photos.txt'), photos.map((p) => `${p}\n`).join(''))

renameSync(dir, join(root, name))
console.log(`\nDone: ${join(root, name)}`)
console.log('It holds password hashes: keep it private (docs/BACKUP.md, step 3).')
