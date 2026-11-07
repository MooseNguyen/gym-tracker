// RepDB free tier (https://repdb.co, https://github.com/RepDB/exercise-dataset):
// in-app use with attribution, no redistribution as a dataset. Pinned to one
// commit so the generated migration is reproducible.
export const REPDB_COMMIT = '66c4298af8d99b9dc397dad6699e508fb871d249'
export const REPDB_RAW = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${REPDB_COMMIT}`

export async function loadRepdb() {
  const res = await fetch(`${REPDB_RAW}/exercises.json`)
  if (!res.ok) throw new Error(`RepDB download failed: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.exercises
}

const has = (name, ...words) => words.some((w) => name.includes(w))

/**
 * The app's muscle value for a RepDB exercise: its first primary muscle,
 * refined by the name where RepDB's anatomy is coarser or differs from how
 * lifters file the lift (squats are quad days, RDLs hamstring days).
 */
export function muscleFor(e) {
  const name = e.name_en.toLowerCase()
  if (e.category === 'cardio') return 'cardio'
  // Every leg press is a quad exercise, whatever the stance stresses most.
  if (name.includes('leg press')) return 'quads'
  const m = e.primary_muscles?.[0]
  switch (m) {
    case 'pectoralis_major':
      // Push-ups invert: feet up (decline) works the upper chest.
      if (has(name, 'push-up', 'push up', 'push-ups', 'push ups')) {
        if (name.includes('decline')) return 'upper-chest'
        if (name.includes('incline')) return 'lower-chest'
        return 'mid-chest'
      }
      if (name.includes('incline')) return 'upper-chest'
      if (has(name, 'decline', 'dip')) return 'lower-chest'
      return 'mid-chest'
    case 'latissimus_dorsi':
      // Two-arm rows read as upper-back work; one-arm rows and pulldowns as lats.
      if (name.includes('row') && !has(name, 'one-arm', 'one arm', 'single-arm', 'single arm'))
        return 'upper-back'
      return 'lats'
    case 'rhomboids':
      return 'upper-back'
    case 'trapezius':
      return name.includes('shrug') ? 'traps' : 'upper-back'
    case 'erector_spinae':
    case 'quadratus_lumborum':
      return 'lower-back'
    case 'anterior_deltoid':
      return 'front-delts'
    case 'lateral_deltoid':
      return 'side-delts'
    case 'posterior_deltoid':
    case 'infraspinatus_teres_minor':
      return 'rear-delts'
    case 'biceps_brachii':
    case 'brachialis':
      return 'biceps'
    case 'brachioradialis':
    case 'forearm_flexors':
    case 'forearm_extensors':
      return 'forearms'
    case 'triceps_brachii':
      return 'triceps'
    case 'quadriceps':
      return 'quads'
    case 'hamstrings':
      return 'hamstrings'
    case 'gluteus_maximus':
      if (has(name, 'romanian', 'rdl', 'stiff leg', 'stiff-leg', 'single leg deadlift'))
        return 'hamstrings'
      if (has(name, 'squat', 'lunge', 'leg press', 'step-up', 'step up', 'pistol', 'box jump'))
        return 'quads'
      return 'glutes'
    case 'gluteus_medius':
    case 'abductors':
    case 'adductors':
      return 'glutes'
    case 'gastrocnemius':
    case 'soleus':
    case 'tibialis_anterior':
      return 'calves'
    case 'rectus_abdominis':
    case 'obliques':
    case 'transverse_abdominis':
    case 'hip_flexors':
      return 'core'
    default:
      throw new Error(`No muscle mapping for ${e.id} (${m})`)
  }
}

const MACHINES = new Set([
  'smith_machine',
  'leg_press',
  'leg_curl',
  'leg_extension',
  'hack_squat',
  'pec_deck',
  'rower',
  'elliptical',
  'treadmill',
  'stationary_bike',
  'stair_climber',
  'ski_erg',
  'air_bike',
  'glute_ham_developer',
])
const BODYWEIGHT = new Set([
  'pull_up_bar',
  'dip_station',
  'rings',
  'flat_bench',
  'plyo_box',
  'suspension_trainer',
  'ab_wheel',
])

/** One of the app's 8 equipment values. The first free weight wins over a bench or box. */
export function equipmentFor(e) {
  const list = [].concat(e.equipment ?? [])
  const pick = (want) => list.find(want)
  if (pick((q) => q === 'barbell' || q === 'ez_bar')) return 'barbell'
  if (pick((q) => q === 'dumbbell')) return 'dumbbell'
  if (pick((q) => q === 'kettlebell')) return 'kettlebell'
  if (pick((q) => q === 'cable')) return 'cable'
  if (pick((q) => q.endsWith('_machine') || MACHINES.has(q))) return 'machine'
  if (pick((q) => q === 'resistance_band' || q === 'loop_band')) return 'band'
  if (list.length === 0 || list.every((q) => BODYWEIGHT.has(q))) return 'bodyweight'
  return 'other' // plates, sled, medicine ball, trap bar, battle rope…
}

// Static positions. Not "hang" (Hang Clean moves) nor "plank" mid-name
// (Plank Knee Tuck, Side Plank with Leg Lift are reps).
const TIMED = [
  'hold',
  'dead hang',
  'arm hang',
  'l-sit',
  'l sit',
  'lever',
  'planche',
  'wall sit',
  'human flag',
]

/**
 * How a set is logged: time for cardio and static holds; reps only when
 * there is no load to weigh (bodyweight, bands); otherwise kg × reps.
 */
export function kindFor(e) {
  const name = e.name_en.toLowerCase()
  if (e.category === 'cardio') return 'duration'
  if (!name.includes('carry') && (TIMED.some((w) => name.includes(w)) || name.endsWith('plank')))
    return 'duration'
  const equipment = equipmentFor(e)
  if (e.is_bodyweight || equipment === 'bodyweight' || equipment === 'band')
    return 'bodyweight_reps'
  return 'weight_reps'
}

/** Kept out of the library: stretches and ball work (asked), plus yoga, pilates and balance drills. */
export function excluded(e) {
  if (e.category === 'stretching') return 'stretching'
  if ([].concat(e.equipment ?? []).some((q) => q === 'bosu_ball' || q === 'stability_ball'))
    return 'ball'
  return null
}

/** Not stretching, but rarely logged in a gym: off by default in the review list. */
export function offByDefault(e) {
  const id = e.id
  const name = e.name_en.toLowerCase()
  if (/pose|warrior|downward-dog|three-legged|crescent|revolved|shoulderstand/.test(id))
    return 'yoga'
  if (id.startsWith('pilates-')) return 'pilates'
  if (/tandem-stance|heel-to-toe|single-leg-stand|chin-tuck|isometric-neck/.test(id))
    return 'balance'
  if (/planche|human-flag|back-lever/.test(id)) return 'skill'
  // A "… Hold" twin of a movement that is in the list anyway.
  const keepHolds = ['hollow-body-hold', 'dead-hang', 'wall-sit', 'plank', 'side-plank']
  if (name.includes('hold') && !keepHolds.includes(id)) return 'hold variant'
  return null
}
