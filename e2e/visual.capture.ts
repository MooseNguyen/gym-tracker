import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { MOCK_SUPABASE_URL } from '../playwright.config'
import { bench, fakeLogin, mockSupabase, type MockOptions } from './mockSupabase'

/**
 * Records every screen for a design review: a full-page screenshot and the
 * measurements a restyle should move (type sizes, colours, radii, small tap
 * targets, low-contrast text, console errors). Run with
 *   $env:VISUAL_LABEL='before'; npm run test:visual
 * and compare .taste-skill/visual/<label>/ between two runs.
 */

const LABEL = process.env.VISUAL_LABEL || 'latest'
const OUT = join('.taste-skill', 'visual', LABEL)
const NOW = new Date('2026-11-23T10:00:00')

// ---------------------------------------------------------------------------
// Fixtures: a believable account (several routines, a few weeks of history)
// so the screens look the way they do in real use, with real photos.
// ---------------------------------------------------------------------------
const squat = {
  ...bench,
  id: 'ex-squat',
  name: 'Squat',
  muscle_group: 'quads',
  image_path: 'repdb-squat.webp',
  image_path_end: 'repdb-squat-end.webp',
}
const row = {
  ...bench,
  id: 'ex-row',
  name: 'Barbell Row',
  muscle_group: 'upper-back',
  image_path: 'repdb-barbell-row.webp',
  image_path_end: null,
}
const library = [bench, squat, row]

const routineExercise = (id: string, e: { id: string }, position: number) => ({
  id,
  exercise_id: e.id,
  position,
  target_sets: 3,
  rest_seconds: 90,
  exercise: e,
})
const routines = [
  {
    id: 'r-upper',
    name: 'Upper',
    notes: null,
    folder_id: 'f-split',
    created_at: '2026-01-01',
    routine_exercises: [routineExercise('re-1', bench, 0), routineExercise('re-2', row, 1)],
  },
  {
    id: 'r-lower',
    name: 'Lower',
    notes: null,
    folder_id: 'f-split',
    created_at: '2026-01-02',
    routine_exercises: [routineExercise('re-3', squat, 0)],
  },
]
const folders = [{ id: 'f-split', name: 'Upper Lower', created_at: '2026-01-01' }]

let setId = 0
const set = (set_type: string, weight_kg: number, reps: number) => ({
  id: `s${++setId}`,
  position: setId,
  set_type,
  weight_kg,
  reps,
  duration_s: null,
  rpe: null,
})
const done = (
  n: number,
  day: string,
  name: string,
  parts: [typeof bench, ReturnType<typeof set>[]][],
) => ({
  id: `00000000-0000-0000-0000-0000000000${n.toString().padStart(2, '0')}`,
  routine_id: null,
  name,
  notes: null,
  started_at: `${day}T18:00:00`,
  ended_at: `${day}T18:55:00`,
  workout_exercises: parts.map(([exercise, sets], i) => ({
    id: `we${n}-${i}`,
    exercise_id: exercise.id,
    position: i,
    notes: null,
    exercise,
    sets,
  })),
})
const history = [
  done(1, '2026-11-21', 'Upper', [
    [bench, [set('warmup', 40, 10), set('normal', 82.5, 8), set('normal', 82.5, 7)]],
    [row, [set('normal', 70, 10), set('failure', 70, 8)]],
  ]),
  done(2, '2026-11-19', 'Lower', [[squat, [set('normal', 110, 5), set('normal', 110, 5)]]]),
  done(3, '2026-11-17', 'Upper', [
    [bench, [set('normal', 80, 8), set('normal', 80, 8)]],
    [row, [set('normal', 67.5, 10)]],
  ]),
]
const workouts = history as unknown as { id: string }[]

/** The exercise stats page reads sets through workout_exercises, embedding its workout. */
const exerciseRows = (exerciseId: string) =>
  history.flatMap((w) =>
    w.workout_exercises
      .filter((e) => e.exercise_id === exerciseId)
      .map((e) => ({ workout: { id: w.id, started_at: w.started_at }, sets: e.sets })),
  )

const bodyWeights = ['2026-11-09', '2026-11-13', '2026-11-17', '2026-11-21'].map((d, i) => ({
  measured_on: d,
  weight_kg: 81.4 - i * 0.3,
}))

const full: MockOptions = {
  exercises: library,
  routines,
  folders,
  workouts,
  bodyWeights,
  previous: { weight_kg: 82.5, reps: 8 },
}

// ---------------------------------------------------------------------------
// Measuring a screen, in the page.
// ---------------------------------------------------------------------------
interface Measures {
  fontSizes: Record<string, number>
  fontWeights: Record<string, number>
  fontFamilies: Record<string, number>
  textColours: Record<string, number>
  fills: Record<string, number>
  radii: Record<string, number>
  smallTargets: string[]
  lowContrast: { text: string; ratio: number; needs: number }[]
}

function measure(): Measures {
  const tally = (map: Record<string, number>, key: string) => (map[key] = (map[key] ?? 0) + 1)
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0'
  }
  // Computed colours come as rgb()/rgba() or, from color-mix, as color(srgb r g b / a).
  const parse = (c: string): [number, number, number, number] | null => {
    let m = c.match(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?\)/)
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
    m = c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/)
    if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] === undefined ? 1 : +m[4]]
    return null
  }
  const over = (top: number[], under: number[]) =>
    [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
  const backdrop = (el: Element | null): number[] => {
    const layers: number[][] = []
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c[3] > 0) {
        layers.push(c)
        if (c[3] === 1) break
      }
    }
    let colour = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1]
    for (const l of layers.reverse()) colour = over(l, colour)
    return colour
  }
  const luminance = ([r, g, b]: number[]) => {
    const ch = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
  }
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const name = (el: Element) =>
    (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)

  const m: Measures = {
    fontSizes: {},
    fontWeights: {},
    fontFamilies: {},
    textColours: {},
    fills: {},
    radii: {},
    smallTargets: [],
    lowContrast: [],
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue
    const s = getComputedStyle(el)
    const ownText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '',
    )
    if (ownText) {
      tally(m.fontSizes, s.fontSize)
      tally(m.fontWeights, s.fontWeight)
      tally(m.fontFamilies, s.fontFamily.split(',')[0].replace(/['"]/g, ''))
      tally(m.textColours, s.color)
      const fg = parse(s.color)
      if (fg) {
        const bg = backdrop(el)
        const r = ratio(over(fg, bg), bg)
        const size = parseFloat(s.fontSize)
        const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700)
        const needs = large ? 3 : 4.5
        if (r < needs) m.lowContrast.push({ text: name(el), ratio: +r.toFixed(2), needs })
      }
    }
    const fill = parse(s.backgroundColor)
    if (fill && fill[3] > 0) tally(m.fills, s.backgroundColor)
    if (s.borderTopLeftRadius !== '0px') tally(m.radii, s.borderTopLeftRadius)
  }
  const targets = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button]'
  for (const el of document.querySelectorAll(targets)) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    // Under 8px is a visually hidden control (sr-only), not a target.
    if (r.width < 8 || r.height < 8) continue
    if (r.height < 44 || r.width < 44)
      m.smallTargets.push(`${name(el)} (${Math.round(r.width)}×${Math.round(r.height)})`)
  }
  return m
}

// ---------------------------------------------------------------------------
// The screens.
// ---------------------------------------------------------------------------
interface Screen {
  name: string
  opts?: MockOptions | null // null: logged out
  path: string
  /** Gets the screen into the state to record, after the page has loaded. */
  act?: (page: Page) => Promise<void>
}

const screens: Screen[] = [
  { name: 'login', opts: null, path: '/login' },
  { name: 'reset-password', opts: null, path: '/reset-password' },
  { name: 'home', path: '/' },
  { name: 'home-empty', opts: {}, path: '/' },
  {
    name: 'workout',
    path: '/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Start Upper' }).click()
      await expect(page).toHaveURL(/\/workout$/)
      const card = page.getByRole('region', { name: bench.name })
      await card.getByLabel('Set 1 weight').fill('82,5')
      await card.getByRole('button', { name: 'Set 1 done' }).click()
      await expect(page.getByRole('timer')).toBeVisible()
    },
  },
  { name: 'routine-editor', path: '/routines/r-upper' },
  { name: 'history', path: '/history' },
  { name: 'history-empty', opts: {}, path: '/history' },
  { name: 'workout-detail', path: `/history/${workouts[0].id}` },
  { name: 'exercises', path: '/exercises' },
  { name: 'exercise-stats', path: `/exercises/${bench.id}` },
  { name: 'muscle-stats', path: '/stats' },
  { name: 'body-weight', path: '/body-weight' },
  {
    name: 'history-error',
    path: '/history',
    act: async (page) => {
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
]

const viewports = [
  { name: 'iphone', size: null },
  { name: 'desktop', size: { width: 1440, height: 900 } },
] as const

for (const vp of viewports) {
  test.describe(vp.name, () => {
    if (vp.size) test.use({ viewport: vp.size, isMobile: false, hasTouch: false })

    for (const screen of screens) {
      test(screen.name, async ({ page }) => {
        const errors: string[] = []
        page.on('console', (msg) => {
          // Error reports go to a fake host in e2e (MOCK_SENTRY_HOST), which never resolves.
          if (msg.type() === 'error' && !msg.text().includes('Could not resolve hostname'))
            errors.push(msg.text())
        })
        page.on('pageerror', (e) => errors.push(e.message))

        await page.clock.setFixedTime(NOW)
        if (screen.opts !== null) {
          await fakeLogin(page)
          await mockSupabase(page, screen.opts ?? full)
        }
        await page.route(`${MOCK_SUPABASE_URL}/rest/v1/workout_exercises*`, (route) => {
          const id = new URL(route.request().url()).searchParams.get('exercise_id') ?? ''
          return route.fulfill({ json: exerciseRows(id.replace('eq.', '')) })
        })
        if (screen.name === 'history-error') {
          await page.route(`${MOCK_SUPABASE_URL}/rest/v1/workouts*`, (route) =>
            route.fulfill({ status: 500, json: { message: 'Database is down' } }),
          )
        }

        await page.goto(screen.path)
        await page.waitForLoadState('networkidle')
        if (screen.act) await screen.act(page)
        await page.evaluate(() => document.fonts.ready)

        const dir = join(OUT, vp.name)
        mkdirSync(dir, { recursive: true })
        // What the eye sees first, fixed bars included.
        await page.screenshot({ path: join(dir, `${screen.name}.png`), animations: 'disabled' })
        // The whole page, without the fixed bars: a full-page shot would paint
        // them once, in the middle of the content.
        await page.evaluate(() => {
          for (const el of document.querySelectorAll('body *'))
            if (getComputedStyle(el).position === 'fixed') el.setAttribute('data-capture-fixed', '')
        })
        await page.screenshot({
          path: join(dir, `${screen.name}-full.png`),
          fullPage: true,
          animations: 'disabled',
          style: '[data-capture-fixed] { visibility: hidden !important; }',
        })
        const measures = await page.evaluate(measure)
        writeFileSync(
          join(dir, `${screen.name}.json`),
          JSON.stringify({ screen: screen.name, url: page.url(), errors, ...measures }, null, 2),
        )
      })
    }
  })
}
