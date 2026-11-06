// Downloads one demo photo per built-in exercise from free-exercise-db and
// converts it to a small WebP in public/exercises/.
//
//   node scripts/fetch-exercise-images.mjs          # skip files that already exist
//   node scripts/fetch-exercise-images.mjs --force  # re-download everything
//
// Run it again only when the mapping (scripts/exercise-images.json) changes.
// The output is committed, so the build never depends on GitHub being up.
import { mkdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(root, 'public', 'exercises')
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const force = process.argv.includes('--force')

// Must match the SQL in supabase/migrations/20261107000000_folders_images.sql:
// regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '.webp'
const fileName = (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  )

const mapping = JSON.parse(await readFile(path.join(root, 'scripts', 'exercise-images.json'), 'utf8'))
delete mapping._source
await mkdir(outDir, { recursive: true })

let done = 0
const failed = []
for (const [name, id] of Object.entries(mapping)) {
  const out = path.join(outDir, fileName(name))
  if (!force && (await exists(out))) continue
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/0.jpg`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const input = Buffer.from(await res.arrayBuffer())
    // Square crop from the centre: thumbnails are square everywhere in the UI.
    await sharp(input).resize(320, 320, { fit: 'cover' }).webp({ quality: 72 }).toFile(out)
    done++
    console.log(`ok   ${name}`)
  } catch (err) {
    failed.push(name)
    console.error(`FAIL ${name} (${id}): ${err.message}`)
  }
}

console.log(`\n${done} written, ${failed.length} failed.`)
if (failed.length) process.exitCode = 1
