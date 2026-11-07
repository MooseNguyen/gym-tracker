// Downloads the RepDB start (and end) image of every built-in in
// scripts/repdb/library.json and writes 320px WebP files to public/exercises/.
// The output is committed, so builds never depend on GitHub.
//
//   node scripts/repdb/fetch-images.mjs          # skip files that exist
//   node scripts/repdb/fetch-images.mjs --force  # redo everything
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { root } from '../library.mjs'
import { loadRepdb, REPDB_RAW } from './repdb.mjs'

const outDir = path.join(root, 'public', 'exercises')
const force = process.argv.includes('--force')
const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  )

const library = JSON.parse(await readFile(path.join(root, 'scripts/repdb/library.json'), 'utf8'))
const byId = new Map((await loadRepdb()).map((e) => [e.id, e]))

const jobs = []
for (const { id, end } of library) {
  const flat = byId.get(id).images.flat
  jobs.push([flat.start ?? flat.main, `repdb-${id}.webp`])
  if (end) jobs.push([flat.peak, `repdb-${id}-end.webp`])
}

let done = 0
const failed = []
// A few downloads at a time: quicker than one by one, polite to GitHub.
const queue = [...jobs]
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [src, file] = job
    const out = path.join(outDir, file)
    if (!force && (await exists(out))) continue
    try {
      const res = await fetch(`${REPDB_RAW}/${src}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const input = Buffer.from(await res.arrayBuffer())
      await sharp(input).resize(320, 320, { fit: 'cover' }).webp({ quality: 75 }).toFile(out)
      done++
    } catch (err) {
      failed.push(`${file}: ${err.message}`)
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
console.log(`${done} written, ${failed.length} failed of ${jobs.length}.`)
if (failed.length) {
  console.error(failed.join('\n'))
  process.exitCode = 1
}
