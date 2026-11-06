import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_SUBGROUPS } from '../src/types/db'
import { imageFileName, libraryProblems } from './library.mjs'

const library = JSON.parse(
  readFileSync(new URL('./exercise-library.json', import.meta.url), 'utf8'),
).exercises
const seedMapping = JSON.parse(
  readFileSync(new URL('./exercise-images.json', import.meta.url), 'utf8'),
)
delete seedMapping._source

describe('imageFileName', () => {
  it('matches the SQL slug used for image_path', () => {
    expect(imageFileName("Farmer's Walk")).toBe('farmer-s-walk.webp')
    expect(imageFileName('Single-Arm Dumbbell Bench Press')).toBe(
      'single-arm-dumbbell-bench-press.webp',
    )
  })
})

describe('libraryProblems', () => {
  it('flags names that would share a photo file and reused dataset ids', () => {
    const problems = libraryProblems({ 'Push Up': 'Pushups' }, [
      { name: 'Push-Up', datasetId: 'Other' },
      { name: 'Dip', datasetId: 'Pushups' },
    ])
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('push-up.webp')
    expect(problems[1]).toContain('Pushups')
  })
})

describe('scripts/exercise-library.json', () => {
  const muscles = new Set([...MUSCLE_GROUPS, ...Object.values(MUSCLE_SUBGROUPS).flat()])

  it('has no name, photo or dataset conflicts with the seed', () => {
    expect(libraryProblems(seedMapping, library)).toEqual([])
  })

  it('only uses values the app knows', () => {
    for (const e of library) {
      expect(muscles.has(e.muscle_group), `${e.name}: ${e.muscle_group}`).toBe(true)
      expect(EQUIPMENT, e.name).toContain(e.equipment)
      expect(['weight_reps', 'bodyweight_reps', 'duration'], e.name).toContain(e.kind)
    }
  })

  it('uses the specific target, not the plain group, where one exists', () => {
    for (const e of library) {
      expect(Object.keys(MUSCLE_SUBGROUPS), e.name).not.toContain(e.muscle_group)
    }
  })
})
