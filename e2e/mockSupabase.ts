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
export async function fakeLogin(page: Page) {
  const ref = new URL(MOCK_SUPABASE_URL).hostname.split('.')[0]
  const session = {
    access_token: 'e2e.fake.token',
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
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

export async function mockSupabase(page: Page, opts: { previous?: Partial<SavedSet> } = {}) {
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

    if (path === '/rest/v1/exercises') return json(route, single ? bench : [bench])
    if (path === '/rest/v1/routines') return json(route, [])
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
    if (path === '/rest/v1/rpc/save_workout') {
      const { p } = req.postDataJSON() as { p: SavedWorkout }
      const i = saved.findIndex((w) => w.id === p.id)
      if (i >= 0) saved[i] = p
      else saved.push(p)
      return json(route, p.id)
    }
    if (path === '/rest/v1/workouts') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (id) {
        const w = saved.find((x) => x.id === id)
        return w ? json(route, asRow(w)) : json(route, { message: 'Not found' }, 406)
      }
      return json(route, saved.map(asRow))
    }
    return json(route, { message: `Unmocked ${req.method()} ${path}` }, 501)
  })

  return { saved }
}
