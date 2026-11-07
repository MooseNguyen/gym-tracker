import type { Page, Route } from '@playwright/test'
import { MOCK_SUPABASE_URL } from '../playwright.config'

/**
 * Network-level fake of the few Supabase endpoints the app calls.
 * This tests the UI flow (draft, persistence, payload) without a real backend.
 * It does NOT test SQL, RLS or the RPCs; those need a real Supabase project.
 */

export const bench = {
  id: '00000000-0000-0000-0000-0000000000b1',
  user_id: null,
  name: 'Bench Press',
  muscle_group: 'chest',
  equipment: 'barbell',
  kind: 'weight_reps',
  image_path: 'repdb-bench-press.webp',
  image_path_end: 'repdb-bench-press-end.webp',
}

const user = {
  id: '00000000-0000-0000-0000-00000000a5e1',
  email: 'e2e@example.test',
  aud: 'authenticated',
  role: 'authenticated',
}

/**
 * Fakes Supabase's password grant: accepts exactly one email/password pair.
 * Register it after mockSupabase(): the most recently added route wins.
 */
export async function mockPasswordAuth(page: Page, valid: { email: string; password: string }) {
  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/token?grant_type=password`, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string }
    if (body.email === valid.email && body.password === valid.password) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e.fake.token',
          refresh_token: 'e2e-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { ...user, email: valid.email },
        }),
      })
    }
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }),
    })
  })
}

/** Puts a fake, non-expired session where supabase-js looks for it. */
export async function fakeLogin(page: Page, { admin = false }: { admin?: boolean } = {}) {
  const ref = new URL(MOCK_SUPABASE_URL).hostname.split('.')[0]
  const session = {
    access_token: 'e2e.fake.token',
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    // Admin rights come from app_metadata (set server-side, see the admin migration).
    user: admin ? { ...user, app_metadata: { role: 'admin' } } : user,
  }
  await page.addInitScript(
    ([key, value]) => {
      // Only seed once, so a reload inside a test keeps whatever the app stored.
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, value)
        sessionStorage.setItem('e2e-seeded', '1')
      }
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  )
}

interface SavedSet {
  set_type: string
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  rpe: number | null
}
export interface SavedWorkout {
  id: string
  routine_id: string | null
  name: string
  notes: string | null
  started_at: string
  ended_at: string
  exercises: { exercise_id: string; notes: string | null; sets: SavedSet[] }[]
}

export interface MockOptions {
  previous?: Partial<SavedSet>
  /** Exercise library; defaults to [bench]. */
  exercises?: { id: string }[]
  routines?: unknown[]
  folders?: unknown[]
  /** Finished workouts already on the server, shaped like the PostgREST embed. */
  workouts?: { id: string }[]
  /** Rows the workout_prs RPC returns (the database decides what is a PR). */
  prs?: { workout_id: string; set_id: string; weight_pr: boolean; e1rm_pr: boolean }[]
}

export async function mockSupabase(page: Page, opts: MockOptions = {}) {
  const saved: SavedWorkout[] = []

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  // Shape a saved payload the way PostgREST would return the embedded select.
  const asRow = (w: SavedWorkout) => ({
    ...w,
    workout_exercises: w.exercises.map((e, i) => ({
      id: `we-${i}`,
      exercise_id: e.exercise_id,
      position: i,
      notes: e.notes,
      exercise: bench,
      sets: e.sets.map((s, j) => ({ id: `s-${i}-${j}`, position: j, ...s })),
    })),
  })

  await page.route(`${MOCK_SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    if (path === '/rest/v1/exercises') {
      const library = opts.exercises ?? [bench]
      if (!single) return json(route, library)
      // .single() by id: the stats page and the instructions sheet.
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const found = [bench, overheadPress, pullUp, ...library].find((e) => e.id === id) ?? bench
      return json(route, { ...found, instructions: INSTRUCTIONS[found.id] ?? null })
    }
    // Sign-out: the server only revokes the refresh token, nothing to return.
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (path === '/rest/v1/routines') return json(route, opts.routines ?? [])
    if (path === '/rest/v1/routine_folders') return json(route, opts.folders ?? [])
    if (path === '/rest/v1/rpc/previous_sets') {
      const prev = opts.previous
      return json(
        route,
        prev
          ? [
              {
                exercise_id: bench.id,
                position: 0,
                set_type: 'normal',
                duration_s: null,
                rpe: null,
                ...prev,
              },
            ]
          : [],
      )
    }
    if (path === '/rest/v1/rpc/workout_prs') {
      const { p_workout_ids } = req.postDataJSON() as { p_workout_ids: string[] }
      return json(
        route,
        (opts.prs ?? []).filter((p) => p_workout_ids.includes(p.workout_id)),
      )
    }
    if (path === '/rest/v1/rpc/save_workout') {
      const { p } = req.postDataJSON() as { p: SavedWorkout }
      const i = saved.findIndex((w) => w.id === p.id)
      if (i >= 0) saved[i] = p
      else saved.push(p)
      return json(route, p.id)
    }
    if (path === '/rest/v1/workouts') {
      const rows = [...saved.map(asRow), ...(opts.workouts ?? [])]
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (id) {
        const w = rows.find((x) => x.id === id)
        return w ? json(route, w) : json(route, { message: 'Not found' }, 406)
      }
      return json(route, rows)
    }
    return json(route, { message: `Unmocked ${req.method()} ${path}` }, 501)
  })

  return { saved }
}

// ---------------------------------------------------------------------------
// Fixtures for routines and folders, shaped like the PostgREST embed.
// ---------------------------------------------------------------------------
const exercise = (id: string, name: string, image_path: string, kind = 'weight_reps') => ({
  id,
  user_id: null,
  name,
  muscle_group: 'chest',
  equipment: 'barbell',
  kind,
  image_path,
})
export const overheadPress = exercise('ex-ohp', 'Overhead Press', 'overhead-press.webp')
export const pullUp = exercise('ex-pull', 'Pull Up', 'pull-up.webp', 'bodyweight_reps')

const routineExercise = (id: string, e: { id: string }, position: number) => ({
  id,
  exercise_id: e.id,
  position,
  target_sets: 3,
  rest_seconds: 90,
  exercise: e,
})

export const folders = [
  { id: 'f-ppl', name: 'Push Pull Legs', created_at: '2026-01-01' },
  { id: 'f-empty', name: 'Upper Lower', created_at: '2026-01-02' },
]

export const routines = [
  {
    id: 'r-push',
    name: 'Push',
    notes: null,
    folder_id: 'f-ppl',
    created_at: '2026-01-01',
    routine_exercises: [
      routineExercise('re-1', bench, 0),
      routineExercise('re-2', overheadPress, 1),
    ],
  },
  {
    id: 'r-pull',
    name: 'Pull',
    notes: null,
    folder_id: 'f-ppl',
    created_at: '2026-01-02',
    routine_exercises: [routineExercise('re-3', pullUp, 0)],
  },
  {
    id: 'r-mobility',
    name: 'Mobility',
    notes: null,
    folder_id: null,
    created_at: '2026-01-03',
    routine_exercises: [],
  },
]

export const customCurl = {
  id: 'ex-custom',
  user_id: '00000000-0000-0000-0000-00000000a5e1',
  name: 'My Cable Curl',
  muscle_group: 'biceps',
  equipment: 'cable',
  kind: 'weight_reps',
  image_path: null,
}

const INSTRUCTIONS: Record<string, string[]> = {
  [bench.id]: [
    'Lie back on a flat bench and unrack the bar.',
    "Lower it to your mid chest; don't bounce.",
    'Press back up and lock your arms.',
  ],
}
