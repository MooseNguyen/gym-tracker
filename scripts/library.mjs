// Shared by the scripts that build the built-in exercise library: the photo
// downloader and the library migration generator.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * Photo file name of a built-in exercise. Must match the SQL in
 * supabase/migrations/20261107000000_folders_images.sql:
 * regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '.webp'
 */
export const imageFileName = (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`

/** Original seed exercises: { name: datasetId } (scripts/exercise-images.json). */
export async function loadSeedMapping() {
  const mapping = JSON.parse(
    await readFile(path.join(root, 'scripts', 'exercise-images.json'), 'utf8'),
  )
  delete mapping._source
  return mapping
}

/** Exercises added later: [{ name, muscle_group, equipment, kind, datasetId }]. */
export async function loadLibrary() {
  const file = JSON.parse(
    await readFile(path.join(root, 'scripts', 'exercise-library.json'), 'utf8'),
  )
  return file.exercises
}

/**
 * Problems that would break the data: two exercises sharing a name or a photo
 * file, or a dataset id used twice. Returns messages; empty = fine.
 */
export function libraryProblems(seedMapping, library) {
  const problems = []
  const byFile = new Map()
  const byId = new Map()
  const all = [
    ...Object.entries(seedMapping).map(([name, datasetId]) => ({ name, datasetId })),
    ...library,
  ]
  for (const { name, datasetId } of all) {
    const file = imageFileName(name)
    if (byFile.has(file)) problems.push(`"${name}" and "${byFile.get(file)}" share ${file}`)
    else byFile.set(file, name)
    if (byId.has(datasetId))
      problems.push(`"${name}" reuses ${datasetId} of "${byId.get(datasetId)}"`)
    else byId.set(datasetId, name)
  }
  return problems
}
