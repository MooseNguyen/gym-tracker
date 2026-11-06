import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  bench,
  customCurl,
  fakeLogin,
  folders,
  mockSupabase,
  pullUp,
  routines,
} from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
  page.on('dialog', (d) => d.accept())
})

async function startPush(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Push 2 exercises', exact: true }).click()
  await page.getByRole('button', { name: 'Start Push' }).click()
  await expect(page).toHaveURL(/\/workout$/)
}

test.describe('home', () => {
  test('groups routines in folders, expands a routine, keeps Start empty last', async ({
    page,
  }) => {
    await mockSupabase(page, { routines, folders })
    await page.goto('/')

    const ppl = page.getByRole('button', { name: 'Push Pull Legs 2', exact: true })
    await expect(ppl).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Unfiled 1', exact: true })).toBeVisible()
    await expect(page.getByText('Empty folder.')).toBeVisible()

    // Collapsed routine: its exercises and Start button are not reachable.
    const push = page.getByRole('button', { name: 'Push 2 exercises', exact: true })
    await expect(push).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('button', { name: 'Start Push' })).toBeHidden()

    await push.click()
    await expect(push).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Overhead Press')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Bench Press demonstration' })).toBeVisible()

    // "+" in a folder opens a new routine already placed in that folder.
    await expect(page.getByRole('link', { name: 'Add routine to Push Pull Legs' })).toHaveAttribute(
      'href',
      '/routines/new?folder=f-ppl',
    )

    // Start empty workout is the last control of the page content.
    const buttons = page.locator('main button')
    await expect(buttons.last()).toHaveText('Start empty workout')
  })
})

test.describe('beat last time', () => {
  test('shows the banner when kg goes up, not when equal', async ({ page }) => {
    await mockSupabase(page, { routines, folders, previous: { weight_kg: 80, reps: 8 } })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await expect(card.getByRole('cell', { name: '80 kg × 8' })).toBeVisible()

    // Same as last time: no banner.
    await card.getByLabel('Set 1 weight').fill('80')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    await expect(page.getByText('Beat last time!')).toHaveCount(0)
    await card.getByRole('button', { name: 'Set 1 done' }).click() // un-tick

    await card.getByLabel('Set 1 weight').fill('82,5')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    await expect(page.locator('.pr-banner')).toContainText('Bench Press: +2.5 kg')
    // The banner goes away by itself.
    await expect(page.getByText('Beat last time!')).toHaveCount(0, { timeout: 5000 })
  })

  test('with Reduce Motion: banner yes, WebGL burst no', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockSupabase(page, { routines, folders, previous: { weight_kg: 80, reps: 8 } })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 reps').fill('10')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    await expect(page.locator('.pr-banner')).toContainText('+2 reps')
    await expect(page.locator('.pr-burst-canvas')).toHaveCount(0)
  })

  test('the WebGL burst cleans up after itself', async ({ page }) => {
    await mockSupabase(page, { routines, folders, previous: { weight_kg: 80, reps: 8 } })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('85')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    const canvas = page.locator('.pr-burst-canvas')
    await expect(canvas).toHaveCount(1)
    // Removed (renderer disposed) once the ~1.4 s animation ends.
    await expect(canvas).toHaveCount(0, { timeout: 4000 })
  })
})

test('reorders with the keyboard via Move buttons, announced by name', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await startPush(page)
  const titles = page.locator('.exercise-title')
  await expect(titles).toHaveText(['Bench Press', 'Overhead Press'])

  // Visually hidden until focused; reachable with Tab like any button.
  const moveDown = page.getByRole('button', { name: 'Move Bench Press down' })
  await moveDown.focus()
  await page.keyboard.press('Enter')

  await expect(titles).toHaveText(['Overhead Press', 'Bench Press'])
  await expect(page.getByTestId('reorder-status')).toHaveText(
    'Bench Press moved to position 2 of 2.',
  )
  // First item has no "up", last item has no "down".
  await expect(page.getByRole('button', { name: 'Move Bench Press down' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Move Overhead Press up' })).toHaveCount(0)
  // The new order is part of the draft, so it survives a reload.
  await page.reload()
  await expect(titles).toHaveText(['Overhead Press', 'Bench Press'])
})

test('rest timer stays correct after the app was in the background', async ({ page }) => {
  await page.clock.install()
  await mockSupabase(page, { routines, folders })
  await startPush(page)
  const card = page.getByRole('region', { name: bench.name })
  await card.getByLabel('Set 1 weight').fill('60')
  await card.getByLabel('Set 1 reps').fill('10')
  await card.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.getByRole('timer')).toContainText('1:30')

  // Simulate a locked phone: JS is frozen, then 60 s later the page is shown again.
  await page.clock.pauseAt(Date.now() + 1000)
  await page.clock.fastForward(60_000)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('timer')).toContainText(/0:(29|30|31)/)
})

test('the home 3D scene is torn down on navigation (no leaked canvases)', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await page.goto('/')
  const canvases = page.locator('.hero-canvas canvas')
  await expect(canvases).toHaveCount(1)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('link', { name: 'History' }).click()
    await expect(canvases).toHaveCount(0)
    await page.getByRole('link', { name: 'Workout' }).click()
    await expect(canvases).toHaveCount(1)
  }
  expect(await page.locator('canvas').count()).toBe(1)
})

test.describe('collapsible exercise cards', () => {
  test('a card folds to its header, keeps its sets, and shows progress', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('60')
    await card.getByLabel('Set 1 reps').fill('10')
    await card.getByRole('button', { name: 'Set 1 done' }).click()

    // The header is just the name now (no "1/3 sets" badge).
    const toggle = card.getByRole('button', { name: 'Bench Press', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(card.getByLabel('Set 1 weight')).toBeHidden()

    await toggle.click()
    await expect(card.getByLabel('Set 1 weight')).toHaveValue('60') // nothing lost
  })

  test('collapse all, reorder while folded, expand all', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const titles = page.locator('.exercise-title')

    await page.getByRole('button', { name: 'Collapse all' }).click()
    await expect(
      page.locator('.exercise-card .disclosure-toggle[aria-expanded="false"]'),
    ).toHaveCount(2)
    await expect(page.getByLabel('Set 1 weight')).toHaveCount(2) // still in the DOM…
    await expect(page.getByLabel('Set 1 weight').first()).toBeHidden() // …but folded away

    await page.getByRole('button', { name: 'Move Bench Press down' }).focus()
    await page.keyboard.press('Enter')
    await expect(titles).toHaveText(['Overhead Press', 'Bench Press'])

    // Still folded after the move; the toggle label flips back.
    await expect(
      page.locator('.exercise-card .disclosure-toggle[aria-expanded="false"]'),
    ).toHaveCount(2)
    await page.getByRole('button', { name: 'Expand all' }).click()
    await expect(
      page.locator('.exercise-card .disclosure-toggle[aria-expanded="true"]'),
    ).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible()
  })
})

test('a set cannot be ticked without reps: the empty field is flagged and focused', async ({
  page,
}) => {
  // No previous workout, so nothing can be filled in automatically.
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  const card = page.getByRole('region', { name: bench.name })
  const reps = card.getByLabel('Set 1 reps')

  await card.getByLabel('Set 1 weight').fill('60')
  await card.getByRole('button', { name: 'Set 1 done' }).click()

  await expect(card.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(card.getByRole('alert')).toHaveText('Enter reps for set 1, then tick it.')
  await expect(reps).toHaveAttribute('aria-invalid', 'true')
  await expect(reps).toBeFocused()
  await expect(page.getByRole('timer')).toHaveCount(0) // no rest started for a refused tick

  await reps.fill('10')
  await expect(card.getByRole('alert')).toHaveCount(0)
  await expect(reps).not.toHaveAttribute('aria-invalid', 'true')
  await card.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(card.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page).toHaveURL(/\/history\//)
  expect(api.saved[0].exercises[0].sets).toEqual([
    { set_type: 'normal', weight_kg: 60, reps: 10, duration_s: null, rpe: null },
  ])
})

test.describe('how to', () => {
  test('opens the steps from an exercise card without losing the workout', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('70')

    await card.getByRole('button', { name: 'How to do Bench Press' }).click()
    const sheet = page.getByRole('dialog', { name: 'How to: Bench Press' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('listitem')).toHaveText([
      'Lie back on a flat bench and unrack the bar.',
      "Lower it to your mid chest; don't bounce.",
      'Press back up and lock your arms.',
    ])
    await expect(sheet.getByRole('link', { name: 'free-exercise-db' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(card.getByLabel('Set 1 weight')).toHaveValue('70')
  })

  test('custom exercises have no how-to button', async ({ page }) => {
    await mockSupabase(page, { routines, folders, exercises: [bench, customCurl] })
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercises' }).click()
    // The picker opens on the filter step; skip it.
    await page.getByRole('button', { name: /^Show all/ }).click()
    await page.getByRole('button', { name: 'Select Bench Press' }).click()
    await page.getByRole('button', { name: 'Select My Cable Curl' }).click()
    await page.getByRole('button', { name: 'Add 2 exercises' }).click()

    await expect(page.getByRole('button', { name: 'How to do Bench Press' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'How to do My Cable Curl' })).toHaveCount(0)
  })

  test('the stats page shows the steps even before any history', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await page.route('**/rest/v1/workout_exercises*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.goto(`/exercises/${bench.id}`)
    await expect(page.getByRole('heading', { name: 'Bench Press', level: 1 })).toBeVisible()
    await expect(page.getByText('No history yet.')).toBeVisible()
    await page.getByRole('button', { name: 'How to do it' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(3)
  })
})

test.describe('compact card', () => {
  test('set type is picked from a list, not cycled', async ({ page }) => {
    const api = await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    const type = card.getByLabel('Set 1 type')
    await expect(type).toHaveValue('normal')
    await expect(type.locator('option')).toHaveText(['Normal', 'Warm-up', 'Drop set', 'Failure'])

    await type.selectOption('drop')
    await expect(card.locator('.set-type').first()).toContainText('D')
    // Straight to any type, without cycling through the others.
    await type.selectOption('warmup')
    await expect(card.locator('.set-type').first()).toContainText('W')

    await card.getByLabel('Set 1 weight').fill('40')
    await card.getByLabel('Set 1 reps').fill('12')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page).toHaveURL(/\/history\//)
    expect(api.saved[0].exercises[0].sets[0].set_type).toBe('warmup')
  })

  test('drags a card from anywhere on it, but not from an input', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const titles = page.locator('.exercise-title')

    const dragTo = async (from: Locator, toY: number) => {
      const box = (await from.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      // Small steps, so the 6 px activation distance and collision checks run.
      await page.mouse.move(box.x + box.width / 2, toY, { steps: 15 })
      await page.mouse.up()
    }
    const bottomOf = async (name: string) => {
      const b = (await page.getByRole('region', { name }).boundingBox())!
      return b.y + b.height
    }

    // Pressing on an input and moving does not drag: typing stays safe.
    const benchCard = page.getByRole('region', { name: bench.name })
    await dragTo(benchCard.getByLabel('Set 1 weight'), (await bottomOf('Overhead Press')) + 30)
    await expect(titles).toHaveText(['Bench Press', 'Overhead Press'])

    // Grabbing the name (inside the accordion toggle) drags, and does not toggle it.
    await page.getByRole('button', { name: 'Collapse all' }).click()
    const benchToggle = page.getByRole('button', { name: 'Bench Press', exact: true })
    await dragTo(benchToggle, (await bottomOf('Overhead Press')) - 4)
    await expect(titles).toHaveText(['Overhead Press', 'Bench Press'])
    await expect(benchToggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('the card header has no drag handle and no set counter', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await expect(card.getByRole('button', { name: /Reorder/ })).toHaveCount(0)
    await expect(card.getByText(/\d+\/\d+ sets/)).toHaveCount(0)
  })
})

test.describe('exercise filters', () => {
  const ex = (id: string, name: string, muscle_group: string, equipment: string) => ({
    id,
    user_id: null,
    name,
    muscle_group,
    equipment,
    kind: 'weight_reps',
    image_path: null,
  })
  const library = [
    ex('e1', 'Bench Press', 'chest', 'barbell'),
    ex('e2', 'Pec Deck', 'chest', 'machine'),
    ex('e3', 'Lateral Raise', 'shoulders', 'dumbbell'),
    ex('e4', 'Leg Press', 'quads', 'machine'),
    ex('e5', 'Pull Up', 'back', 'bodyweight'),
  ]

  test('chips and the body map select the same muscle group', async ({ page }) => {
    await mockSupabase(page, { exercises: library })
    await page.goto('/exercises')
    const chest = page.getByRole('button', { name: 'Chest', exact: true })

    // Tapping the chest on the drawing ticks the Chest chip and lights the region.
    await page.locator('[data-testid="body-map-front"] [data-region="chest"]').first().click()
    await expect(chest).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.locator('[data-testid="body-map-front"] [data-region="chest"].on'),
    ).toHaveCount(2)

    // Back is on the other side of the body.
    await page.getByRole('button', { name: 'Back', exact: true }).last().click()
    await page.locator('[data-testid="body-map-back"] [data-region="upper-back"]').first().click()
    await expect(page.getByRole('button', { name: 'Back', exact: true }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Show 3 exercises' })).toBeVisible()

    // Decorative parts (head) select nothing.
    await page.locator('[data-testid="body-map-back"] [data-region="head"]').click()
    await expect(page.getByRole('button', { name: 'Show 3 exercises' })).toBeVisible()
  })

  test('muscles AND equipment, with removable filter chips on the results', async ({ page }) => {
    await mockSupabase(page, { exercises: library })
    await page.goto('/exercises')
    await page.getByRole('button', { name: 'Chest', exact: true }).click()
    await page.getByRole('button', { name: 'Quads', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show 3 exercises' })).toBeVisible()

    await page.getByRole('button', { name: 'Equipment' }).click()
    const machine = page.getByRole('button', { name: 'Machine' })
    await machine.click()
    await expect(machine).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Show 2 exercises' }).click()

    const results = page.locator('.list-item')
    await expect(results).toHaveCount(2)
    await expect(results).toContainText(['Pec Deck', 'Leg Press'])

    await page.getByRole('button', { name: 'Remove filter machine' }).click()
    await expect(results).toHaveCount(3)

    // Back to the filters: the selection is kept.
    await page.getByRole('button', { name: '← Filters' }).click()
    await expect(page.getByRole('button', { name: 'Chest', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('a picked group can be narrowed to its sub-muscles', async ({ page }) => {
    await mockSupabase(page, {
      exercises: [
        ex('b1', 'Lat Pulldown', 'lats', 'cable'),
        ex('b2', 'Barbell Row', 'upper-back', 'barbell'),
        ex('b3', 'Barbell Shrug', 'traps', 'barbell'),
        ex('b4', 'My Old Row', 'back', 'machine'), // custom value from before the split
        ex('c1', 'Incline Bench Press', 'upper-chest', 'barbell'),
      ],
    })
    await page.goto('/exercises')
    const targets = page.getByRole('list', { name: 'Back targets' })
    await expect(targets).toHaveCount(0)

    // The whole group, legacy "back" included.
    await page.getByRole('button', { name: 'Back', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Show 4 exercises' })).toBeVisible()

    // Narrow to lats + traps; the group chip stays ticked.
    await targets.getByRole('button', { name: 'Lats' }).click()
    await targets.getByRole('button', { name: 'Traps' }).click()
    await expect(page.getByRole('button', { name: 'Back', exact: true }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Show 2 exercises' }).click()
    const results = page.locator('.list-item')
    await expect(results).toContainText(['Lat Pulldown', 'Barbell Shrug'])
    await expect(results.first()).toContainText('lats · cable')
  })

  test('typing a name jumps straight to the results', async ({ page }) => {
    await mockSupabase(page, { exercises: library })
    await page.goto('/exercises')
    await page.getByLabel('Search exercises').fill('press')
    await expect(page.locator('.list-item')).toHaveCount(2)
    await expect(page.getByRole('button', { name: '← Filters' })).toBeVisible()
  })

  test('no match disables the show button', async ({ page }) => {
    await mockSupabase(page, { exercises: library })
    await page.goto('/exercises')
    await page.getByRole('button', { name: 'Calves', exact: true }).click()
    await expect(page.getByRole('button', { name: 'No exercises match' })).toBeDisabled()
  })
})

test.describe('history', () => {
  const s = (id: string, set_type: string, weight_kg: number | null, reps: number) => ({
    id,
    position: 0,
    set_type,
    weight_kg,
    reps,
    duration_s: null,
    rpe: null,
  })
  const workout = {
    id: '00000000-0000-0000-0000-0000000000f1',
    routine_id: null,
    name: 'Push day',
    started_at: '2026-11-06T18:00:00Z',
    ended_at: '2026-11-06T18:52:00Z',
    notes: 'Felt strong',
    workout_exercises: [
      {
        id: 'we1',
        exercise_id: bench.id,
        position: 0,
        notes: null,
        exercise: { ...bench, muscle_group: 'mid-chest' },
        sets: [s('a', 'warmup', 40, 10), s('b', 'normal', 80, 8), s('c', 'failure', 80, 6)],
      },
      {
        id: 'we2',
        exercise_id: pullUp.id,
        position: 1,
        notes: null,
        exercise: { ...pullUp, muscle_group: 'lats' },
        sets: [s('d', 'normal', null, 10)],
      },
    ],
  }

  test('a card summarises the workout, the detail page breaks it down', async ({ page }) => {
    await mockSupabase(page, { workouts: [workout] })
    await page.goto('/history')

    const card = page.getByRole('link', { name: /Push day/ })
    // Warm-ups are not counted: 3 working sets, 80×8 + 80×6 = 1,120 kg.
    await expect(card.locator('.history-stats')).toContainText('52 min')
    await expect(card.locator('.history-stats')).toContainText('3')
    await expect(card.locator('.history-stats')).toContainText('1,120 kg')
    await expect(card).toContainText('2 × Bench Press')
    await expect(card).toContainText('best 80 kg × 8')
    await expect(card.getByRole('list', { name: 'Muscles trained' })).toHaveText(/chest.*back/)
    await expect(card).toContainText('Felt strong')

    await card.click()
    await expect(page).toHaveURL(/\/history\/0{8}-/)
    await expect(page.locator('.detail-stats')).toContainText('+1 warm-up')
    const muscles = page.getByRole('region', { name: 'Muscles' })
    await expect(muscles).toContainText('mid chest')
    await expect(muscles).toContainText('lats')

    const benchTable = page.getByRole('table').first()
    await expect(benchTable.getByRole('row')).toHaveCount(4) // header + W, 1, 2 F
    await expect(benchTable.getByRole('cell', { name: 'W', exact: true })).toBeVisible()
    await expect(benchTable.getByRole('cell', { name: '2 F' })).toBeVisible()
    await expect(page.getByText('Best 80 kg × 8 (e1RM 101.3 kg)')).toBeVisible()
  })
})
