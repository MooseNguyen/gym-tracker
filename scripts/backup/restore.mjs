// Restores a backup made by backup.mjs into a fresh Supabase project, then
// checks the row counts against the ones saved with the backup.
//
//   npm run restore -- <backup folder>
//
// Reads RESTORE_DB_URL, RESTORE_URL and RESTORE_SERVICE_KEY from .env.restore.
// The schema must already be there (`npx supabase db push`). See docs/BACKUP.md.
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, pg, printErrorsPlainly, query, BUCKET } from './pg.mjs'

printErrorsPlainly()
const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(process.argv[2] ?? '')
if (!process.argv[2] || !existsSync(join(dir, 'counts.txt'))) {
  throw new Error('Usage: npm run restore -- <backup folder> (a folder holding counts.txt)')
}
const db = env('RESTORE_DB_URL')
const storage = createClient(env('RESTORE_URL'), env('RESTORE_SERVICE_KEY'), {
  auth: { persistSession: false },
}).storage

console.log(`Restoring ${dir}`)
pg('psql', ['-d', db, '-X', '-q', '-f', join(here, 'restore.sql')], { cwd: dir })

// Uploading through the Storage API also creates the storage.objects rows.
// The service key is needed here: only admins may upload.
const photos = readFileSync(join(dir, 'photos.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
for (const [i, path] of photos.entries()) {
  const bytes = readFileSync(join(dir, 'images', ...path.split('/')))
  const { error } = await storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`upload ${path}: ${error.message}`)
  console.log(`  photo ${i + 1}/${photos.length} ${path}`)
}

const lines = (text) => text.split(/\r?\n/).filter(Boolean)
const expected = lines(readFileSync(join(dir, 'counts.txt'), 'utf8'))
const actual = query(db, readFileSync(join(here, 'counts.sql'), 'utf8'))
const diffs = expected.filter((line, i) => line !== actual[i])
console.log('\nCounts (backup → restored):')
for (const [i, line] of expected.entries()) {
  const [label, count] = line.split('|')
  const mark = line === actual[i] ? 'ok' : 'DIFFERENT'
  console.log(`  ${label.padEnd(28)} ${count} → ${actual[i]?.split('|')[1]}  ${mark}`)
}
if (diffs.length) {
  console.error('\nSome counts differ: the restore is not complete.')
  process.exit(1)
}
console.log('\nRestore complete: every count matches.')
