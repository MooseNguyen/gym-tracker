// Downloads one demo photo per built-in exercise from free-exercise-db and
// converts it to a small WebP in public/exercises/.
//
//   node scripts/fetch-exercise-images.mjs          # skip files that already exist
//   node scripts/fetch-exercise-images.mjs --force  # re-download everything
//
// Run it again only when scripts/exercise-images.json (original seed) or
// scripts/exercise-library.json (later additions) changes.
// The output is committed, so the build never depends on GitHub being up.
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { imageFileName, libraryProblems, loadLibrary, loadSeedMapping, root } from './library.mjs'

const outDir = path.join(root, 'public', 'exercises')
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const force = process.argv.includes('--force')

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  )

const mapping = await loadSeedMapping()
const library = await loadLibrary()
// Two exercises sharing a file name would silently overwrite each other's photo.
const problems = libraryProblems(mapping, library)
if (problems.length) throw new Error(`Library has conflicts:\n${problems.join('\n')}`)
await mkdir(outDir, { recursive: true })

const all = [...Object.entries(mapping), ...library.map((e) => [e.name, e.datasetId])]
let done = 0
const failed = []
for (const [name, id] of all) {
  const out = path.join(outDir, imageFileName(name))
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
