// Writes scripts/repdb-review.md: what the RepDB switch does to the current
// built-ins (renamed / hidden) and which RepDB exercises would be added.
// Tick or untick lines there; scripts/repdb/build-library.mjs reads it back.
//
//   node scripts/repdb/build-review.mjs
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { root } from '../library.mjs'
import {
  equipmentFor,
  excluded,
  kindFor,
  loadRepdb,
  muscleFor,
  offByDefault,
  REPDB_RAW,
} from './repdb.mjs'

const read = async (p) => readFile(path.join(root, p), 'utf8')
const seed = [
  ...(await read('supabase/seed.sql')).matchAll(
    /\(null, '((?:[^']|'')+)', '([a-z-]+)', '([a-z]+)'/g,
  ),
].map((m) => ({ name: m[1].replace(/''/g, "'"), muscle: m[2], equipment: m[3] }))
const library = JSON.parse(await read('scripts/exercise-library.json')).exercises.map((e) => ({
  name: e.name,
  muscle: e.muscle_group,
  equipment: e.equipment,
}))
const current = [...seed, ...library]
const oldMap = JSON.parse(await read('scripts/repdb/old-to-repdb.json'))
delete oldMap._note

const repdb = await loadRepdb()
const byId = new Map(repdb.map((e) => [e.id, e]))

// Every current built-in must be decided, every target must exist, once.
const problems = []
const used = new Map()
for (const c of current) {
  if (!(c.name in oldMap)) problems.push(`not in old-to-repdb.json: ${c.name}`)
}
for (const [name, id] of Object.entries(oldMap)) {
  if (id == null) continue
  if (!byId.has(id)) problems.push(`${name} → unknown RepDB id ${id}`)
  if (used.has(id)) problems.push(`${id} used by both ${used.get(id)} and ${name}`)
  used.set(id, name)
}
if (problems.length) throw new Error(problems.join('\n'))

const img = (e) => `${REPDB_RAW}/${e.images.flat.start ?? e.images.flat.main}`
const L = [
  '# RepDB library review',
  '',
  'Temporary review file (removed once the list is final). Data: [RepDB](https://repdb.co) free tier, pinned commit.',
  '',
  '- **Renamed**: current built-ins that become the RepDB exercise (name, photo, steps). History and routines keep pointing at them. Their muscle and log type stay as they are.',
  '- **Hidden**: no RepDB match. Kept for history and routines, gone from the pickers.',
  '- **New**: `[x]` = added, `[ ]` = left out. Tick or untick freely; you may edit muscle / equipment / log type in a row (keep the `|`).',
  '',
]

const renamed = current.filter((c) => oldMap[c.name])
const hidden = current.filter((c) => oldMap[c.name] == null)
L.push(`## Renamed (${renamed.length})`, '', '| Current | Becomes | Equipment |', '|---|---|---|')
for (const c of renamed) {
  const e = byId.get(oldMap[c.name])
  const eq = equipmentFor(e)
  L.push(`| ${c.name} | ${e.name_en} | ${eq === c.equipment ? eq : `${c.equipment} → **${eq}**`} |`)
}
L.push('', `## Hidden (${hidden.length})`, '', hidden.map((c) => c.name).join(', '), '')

const candidates = repdb.filter((e) => !used.has(e.id) && !excluded(e))
const rows = candidates.map((e) => ({
  e,
  muscle: muscleFor(e),
  equipment: equipmentFor(e),
  kind: kindFor(e),
  off: offByDefault(e),
}))
const kept = rows.filter((r) => !r.off).length
L.push(`## New (${kept} ticked of ${rows.length})`, '')
const order = [
  'upper-chest',
  'mid-chest',
  'lower-chest',
  'lats',
  'upper-back',
  'traps',
  'lower-back',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
]
for (const m of order) {
  const group = rows
    .filter((r) => r.muscle === m)
    .sort((a, b) => a.e.name_en.localeCompare(b.e.name_en))
  if (!group.length) continue
  L.push(`### ${m} (${group.filter((r) => !r.off).length} of ${group.length})`, '')
  for (const r of group) {
    const note = r.off ? ` _(off: ${r.off})_` : ''
    L.push(
      `- [${r.off ? ' ' : 'x'}] **${r.e.name_en}** | ${r.muscle} | ${r.equipment} | ${r.kind} | [image](${img(r.e)}) | \`${r.e.id}\`${note}`,
    )
  }
  L.push('')
}

await writeFile(path.join(root, 'scripts', 'repdb-review.md'), L.join('\n'))
console.log(`renamed ${renamed.length}, hidden ${hidden.length}, new ${kept}/${rows.length}`)
