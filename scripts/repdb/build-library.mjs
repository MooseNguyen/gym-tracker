// Turns the reviewed scripts/repdb-review.md into:
//   - scripts/repdb/library.json: every built-in that uses RepDB data (for the image script)
//   - supabase/migrations/20261111000000_repdb_library.sql
//
//   node scripts/repdb/build-library.mjs
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { sqlString, sqlTextArray } from '../sql.mjs'
import { equipmentFor, loadRepdb, root } from './repdb.mjs'

const read = (p) => readFile(path.join(root, p), 'utf8')
const MIGRATION = 'supabase/migrations/20261111000000_repdb_library.sql'

// The migration already ran on production: never rewrite it. A later change
// to the library needs a new migration with its own name.
const tracked = (() => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', MIGRATION], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()
if (tracked && !process.argv.includes('--force')) {
  throw new Error(`${MIGRATION} is committed (and applied): write a new migration instead`)
}

export const imageFile = (id) => `repdb-${id}.webp`
export const imageFileEnd = (id) => `repdb-${id}-end.webp`

const repdb = await loadRepdb()
const byId = new Map(repdb.map((e) => [e.id, e]))
const oldMap = JSON.parse(await read('scripts/repdb/old-to-repdb.json'))
delete oldMap._note

// Ticked rows of the "New" section: - [x] **Name** | muscle | equipment | kind | [image](…) | `id`
const ROW =
  /^- \[(x| )\] \*\*(.+?)\*\* \| ([a-z-]+) \| ([a-z]+) \| ([a-z_]+) \| \[image\]\(.+?\) \| `([^`]+)`/
const review = await read('scripts/repdb-review.md')
const added = []
for (const line of review.split(/\r?\n/)) {
  const m = line.match(ROW)
  if (!m) {
    if (/^- \[/.test(line)) throw new Error(`Unreadable review line: ${line}`)
    continue
  }
  if (m[1] !== 'x') continue
  const [, , name, muscle_group, equipment, kind, id] = m
  if (!byId.has(id)) throw new Error(`Unknown RepDB id in review: ${id}`)
  added.push({ id, name, muscle_group, equipment, kind })
}

/** Steps for the How-to: RepDB's instructions, then its tips. */
const steps = (e) => [
  ...(e.instructions_en ?? []).map((s) => s.trim()).filter(Boolean),
  ...(e.tips_en ?? []).map((s) => `Tip: ${s.trim()}`).filter((s) => s !== 'Tip: '),
]
const ends = (e) => Boolean(e.images.flat.peak)

const renamed = Object.entries(oldMap)
  .filter(([, id]) => id)
  .map(([oldName, id]) => ({ oldName, id, e: byId.get(id) }))
const hidden = Object.entries(oldMap)
  .filter(([, id]) => !id)
  .map(([oldName]) => oldName)

// A name must not be used twice among visible built-ins.
const names = new Map()
for (const n of [...renamed.map((r) => r.e.name_en), ...added.map((a) => a.name)]) {
  if (names.has(n)) throw new Error(`Duplicate name after the switch: ${n}`)
  names.set(n, true)
}

const renameValues = renamed.map(({ oldName, id, e }) =>
  [
    sqlString(oldName),
    sqlString(e.name_en),
    sqlString(equipmentFor(e)),
    sqlString(imageFile(id)),
    ends(e) ? sqlString(imageFileEnd(id)) : 'null',
    sqlTextArray(steps(e)),
  ].join(', '),
)

// Rows already on RepDB data are done and must not be touched again. This
// matters when the steps run a second time (seed.sql used to replay them): an
// old name can by then belong to an already renamed row (Barbell Preacher Curl
// became "Preacher Curl", the old "Preacher Curl" becomes Machine Preacher
// Curl), and a hidden old name can be a new RepDB name ("Cable Fly").
const NOT_REPDB = `(e.image_path is null or e.image_path not like 'repdb-%')`

// One UPDATE … FROM VALUES: every row is matched against the names as they
// were before the statement, so renames can never chain (A → B while B → C).
const renameSql = `update exercises e
set name = v.new_name,
    equipment = v.equipment,
    image_path = v.image_path,
    image_path_end = v.image_path_end,
    instructions = v.instructions
from (values
${renameValues.map((v) => `  (${v})`).join(',\n')}
) as v (old_name, new_name, equipment, image_path, image_path_end, instructions)
where e.user_id is null and e.name = v.old_name and ${NOT_REPDB};`

const hideSql = `update exercises e set hidden = true
where e.user_id is null and ${NOT_REPDB}
  and e.name in (${hidden.map(sqlString).join(', ')});`

const insertValues = added.map((a) => {
  const e = byId.get(a.id)
  return [
    sqlString(a.name),
    sqlString(a.muscle_group),
    sqlString(a.equipment),
    sqlString(a.kind),
    sqlString(imageFile(a.id)),
    ends(e) ? sqlString(imageFileEnd(a.id)) : 'null',
    sqlTextArray(steps(e)),
  ].join(', ')
})
const insertSql = `insert into exercises
  (user_id, name, muscle_group, equipment, kind, image_path, image_path_end, instructions)
select null::uuid, v.name, v.muscle_group, v.equipment, v.kind::exercise_kind,
       v.image_path, v.image_path_end, v.instructions
from (values
${insertValues.map((v) => `  (${v})`).join(',\n')}
) as v (name, muscle_group, equipment, kind, image_path, image_path_end, instructions)
where not exists (select 1 from exercises e where e.user_id is null and e.name = v.name);`

const body = `-- 1. Built-ins that RepDB covers take its name, equipment, photos and steps.
--    Muscle and log type stay: sets already logged keep their meaning.
${renameSql}

-- 2. Built-ins RepDB doesn't cover: hidden from pickers, still shown in
--    history and routines that use them.
${hideSql}

-- 3. New built-ins from RepDB (names already taken are skipped, so this can re-run).
${insertSql}
`

await writeFile(
  path.join(root, MIGRATION),
  `-- Built-in exercise library from RepDB (https://repdb.co), free tier: in-app
-- use with attribution, no redistribution as a dataset.
-- GENERATED by scripts/repdb/build-library.mjs from scripts/repdb-review.md, do not edit by hand.

alter table exercises add column hidden boolean not null default false;
-- Second photo (end of the movement) for the How-to animation. Null = one photo.
alter table exercises add column image_path_end text;

${body}`,
)

// For the image script: every built-in shown with a RepDB photo.
const library = [
  ...renamed.map(({ id, e }) => ({ id, name: e.name_en, end: ends(e) })),
  ...added.map((a) => ({ id: a.id, name: a.name, end: ends(byId.get(a.id)) })),
]
await writeFile(
  path.join(root, 'scripts/repdb/library.json'),
  `${JSON.stringify(library, null, 2)}\n`,
)

console.log(`renamed ${renamed.length}, hidden ${hidden.length}, added ${added.length}`)
console.log(`visible built-ins after the switch: ${renamed.length + added.length}`)
