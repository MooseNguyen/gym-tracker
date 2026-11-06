import type { Exercise } from '../../types/db'
import type { BodyPart } from './bodyMap/data'

/**
 * Which drawn body regions light up for each muscle group in the app.
 * Groups with no region (cardio) can only be picked from the chip list.
 * Head, neck, knees, abductors and adductors are drawn but belong to no group.
 */
export const GROUP_REGIONS: Record<string, BodyPart[]> = {
  chest: ['chest'],
  back: ['trapezius', 'upper-back', 'lower-back'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
  core: ['abs', 'obliques'],
  cardio: [],
}

/** The muscle group a tapped region selects, or null for decorative parts. */
export function groupForRegion(part: BodyPart): string | null {
  for (const [group, parts] of Object.entries(GROUP_REGIONS)) {
    if (parts.includes(part)) return group
  }
  return null
}

export interface ExerciseFilters {
  muscles: ReadonlySet<string>
  equipment: ReadonlySet<string>
  query: string
}

export const NO_FILTERS: ExerciseFilters = { muscles: new Set(), equipment: new Set(), query: '' }

/**
 * Any of the picked muscles AND any of the picked equipment AND the name
 * contains the query. An empty selection in a category means "all".
 */
export function filterExercises(list: Exercise[], f: ExerciseFilters): Exercise[] {
  const q = f.query.trim().toLowerCase()
  return list.filter(
    (e) =>
      (f.muscles.size === 0 || f.muscles.has(e.muscle_group)) &&
      (f.equipment.size === 0 || f.equipment.has(e.equipment)) &&
      (!q || e.name.toLowerCase().includes(q)),
  )
}

/** Returns a new set with `value` added or removed (immutable, for React state). */
export function toggle(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
