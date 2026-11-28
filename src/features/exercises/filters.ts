import { MUSCLE_SUBGROUPS, muscleParent, type Exercise } from '../../types/db'
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
  /** Only exercises added from the app, not the library that ships with it. */
  addedInApp: boolean
  query: string
}

export const NO_FILTERS: ExerciseFilters = {
  muscles: new Set(),
  equipment: new Set(),
  addedInApp: false,
  query: '',
}

/** Shared by the filter chip and its removable chip on the results bar. */
export const ADDED_IN_APP_LABEL = 'Added in app'

/**
 * Added from the app (an admin's built-in or a custom exercise). Cached data
 * from before the column existed falls back to "custom exercises only".
 */
export function isAddedInApp(e: Exercise): boolean {
  return e.added_in_app ?? e.user_id !== null
}

/**
 * Any of the picked muscles AND any of the picked equipment AND (when on)
 * added in the app AND the name contains the query. An empty selection in a
 * category means "all".
 * A picked group ('back') also matches its sub-muscles ('lats', ...); a
 * picked sub-muscle matches only itself.
 */
export function filterExercises(list: Exercise[], f: ExerciseFilters): Exercise[] {
  const q = f.query.trim().toLowerCase()
  return list.filter(
    (e) =>
      (f.muscles.size === 0 ||
        f.muscles.has(e.muscle_group) ||
        f.muscles.has(muscleParent(e.muscle_group))) &&
      (f.equipment.size === 0 || f.equipment.has(e.equipment)) &&
      (!f.addedInApp || isAddedInApp(e)) &&
      (!q || e.name.toLowerCase().includes(q)),
  )
}

/** Groups that are picked directly or through one of their sub-muscles. */
export function activeGroups(muscles: ReadonlySet<string>): Set<string> {
  return new Set([...muscles].map(muscleParent))
}

/**
 * Tapping a group chip (or the body map): off → the whole group; on (whole
 * group or narrowed to sub-muscles) → off, sub-muscles included.
 */
export function toggleGroup(muscles: ReadonlySet<string>, group: string): Set<string> {
  const next = new Set(muscles)
  if (activeGroups(muscles).has(group)) {
    next.delete(group)
    for (const s of MUSCLE_SUBGROUPS[group as keyof typeof MUSCLE_SUBGROUPS] ?? []) next.delete(s)
  } else {
    next.add(group)
  }
  return next
}

/**
 * Tapping a sub-muscle chip narrows its group: the group itself is replaced
 * by the picked sub-muscles, and un-picking the last one goes back to the
 * whole group (so the group stays selected until its own chip is tapped).
 */
export function toggleSubgroup(muscles: ReadonlySet<string>, sub: string): Set<string> {
  const group = muscleParent(sub)
  const next = toggle(muscles, sub)
  next.delete(group)
  const subs = MUSCLE_SUBGROUPS[group as keyof typeof MUSCLE_SUBGROUPS] ?? []
  if (!subs.some((s) => next.has(s))) next.add(group)
  return next
}

/** Returns a new set with `value` added or removed (immutable, for React state). */
export function toggle(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
