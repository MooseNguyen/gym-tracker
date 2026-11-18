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
})

/** Opens an exercise's ⋯ actions sheet and picks one item. */
async function exerciseAction(page: Page, exercise: string, item: string) {
  await page.getByRole('button', { name: `More actions for ${exercise}` }).click()
  await page.getByRole('dialog', { name: exercise }).getByRole('button', { name: item }).click()
}

/**
 * Finish a Push workout, and confirm dropping the sets left unticked. One set
 * done is not the routine's 3 + 3, so it asks about Push too: keep it.
 */
async function finishDroppingUnticked(page: Page) {
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await page
    .getByRole('dialog', { name: 'Update "Push"?' })
    .getByRole('button', { name: 'Keep routine' })
    .click()
}

async function startPush(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Push' }).click() // no need to open the card
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

    // Collapsed routine: the exercises are hidden, but Start is always there.
    const push = page.getByRole('button', { name: 'Push 2 exercises', exact: true })
    await expect(push).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Overhead Press')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Start Push' })).toHaveText('Start Routine')

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
    await page.getByRole('link', { name: 'Workout', exact: true }).click()
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

  await finishDroppingUnticked(page)
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

    await exerciseAction(page, bench.name, 'How to do it')
    const sheet = page.getByRole('dialog', { name: 'How to: Bench Press' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('listitem')).toHaveText([
      'Lie back on a flat bench and unrack the bar.',
      "Lower it to your mid chest; don't bounce.",
      'Press back up and lock your arms.',
    ])
    // Start and end photos of the movement, with RepDB's required credit.
    const frames = sheet.getByRole('img', { name: 'Bench Press, start and end' })
    await expect(frames.locator('img')).toHaveCount(2)
    await expect(frames.locator('img').last()).toHaveAttribute(
      'src',
      '/exercises/repdb-bench-press-end.webp',
    )
    await expect(sheet.getByRole('link', { name: 'RepDB (repdb.co)' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(card.getByLabel('Set 1 weight')).toHaveValue('70')
  })

  test('custom exercises have no how-to item', async ({ page }) => {
    await mockSupabase(page, { routines, folders, exercises: [bench, customCurl] })
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercises' }).click()
    // The picker opens on the filter step; skip it.
    await page.getByRole('button', { name: /^Show all/ }).click()
    await page.getByRole('button', { name: 'Select Bench Press' }).click()
    await page.getByRole('button', { name: 'Select My Cable Curl' }).click()
    await page.getByRole('button', { name: 'Add 2 exercises' }).click()

    await page.getByRole('button', { name: 'More actions for Bench Press' }).click()
    const benchMenu = page.getByRole('dialog', { name: 'Bench Press' })
    await expect(benchMenu.getByRole('button', { name: 'How to do it' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'More actions for My Cable Curl' }).click()
    const curlMenu = page.getByRole('dialog', { name: 'My Cable Curl' })
    await expect(curlMenu.getByRole('button', { name: 'Replace exercise' })).toBeVisible()
    await expect(curlMenu.getByRole('button', { name: 'How to do it' })).toHaveCount(0)
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
    await finishDroppingUnticked(page)
    await expect(page).toHaveURL(/\/history\//)
    expect(api.saved[0].exercises[0].sets[0].set_type).toBe('warmup')
  })

  test('drags a card from anywhere on it, but not from an input', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const titles = page.locator('.exercise-title')

    /**
     * Presses, moves in small steps (so the 6 px activation distance and the
     * collision checks run), and releases only once `landed` shows the app
     * has caught up. Playwright moves far faster than a finger: released
     * right away, the drop used the target from before the last moves.
     */
    const dragTo = async (from: Locator, toY: number, landed?: () => Promise<void>) => {
      const box = (await from.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, toY, { steps: 15 })
      await landed?.()
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
    // Cards fold over 0.3 s; measuring mid-animation aimed the drop below the
    // screen. The panels turn visibility:hidden only once folded (see
    // .disclosure-panel), so a hidden input means the layout has settled.
    await expect(
      page.getByRole('region', { name: 'Overhead Press' }).getByLabel('Set 1 weight'),
    ).toBeHidden()
    await expect(benchCard.getByLabel('Set 1 weight')).toBeHidden()
    const benchToggle = page.getByRole('button', { name: 'Bench Press', exact: true })
    await dragTo(benchToggle, (await bottomOf('Overhead Press')) - 4, () =>
      // dnd-kit's screen reader announcement of where the card would drop.
      expect(page.getByText('Bench Press moved to position 2 of 2.')).toBeAttached(),
    )
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

  test('asks only for exercises that are not retired', async ({ page }) => {
    await mockSupabase(page, { exercises: library })
    const list = page.waitForRequest(
      (r) => r.url().includes('/rest/v1/exercises') && r.method() === 'GET',
    )
    await page.goto('/exercises')
    expect(new URL((await list).url()).searchParams.get('hidden')).toBe('eq.false')
    await expect(page.getByRole('link', { name: 'RepDB (repdb.co)' })).toBeVisible()
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

  test('marks the personal records the database found', async ({ page }) => {
    await mockSupabase(page, {
      workouts: [workout],
      prs: [
        { workout_id: workout.id, set_id: 'b', weight_pr: true, e1rm_pr: true },
        { workout_id: workout.id, set_id: 'c', weight_pr: false, e1rm_pr: true },
      ],
    })
    await page.goto('/history')
    const card = page.getByRole('link', { name: /Push day/ })
    await expect(card.locator('.pr-badge')).toHaveText('🏆 2 PRs')

    await card.click()
    await expect(page.locator('.pr-badge')).toHaveText('🏆 2 PRs')
    const benchTable = page.getByRole('table').first()
    await expect(benchTable.getByRole('row', { name: /^1 / })).toContainText(
      'personal record: heaviest weight and best estimated 1RM',
    )
    await expect(benchTable.getByRole('row', { name: /^2 F/ })).toContainText(
      'personal record: best estimated 1RM',
    )
    await expect(benchTable.getByRole('row', { name: /^W / })).not.toContainText('personal record')
  })

  test('no badge without records, and History still works if the PR lookup fails', async ({
    page,
  }) => {
    await mockSupabase(page, { workouts: [workout] })
    await page.route('**/rest/v1/rpc/workout_prs', (r) => r.fulfill({ status: 500, json: {} }))
    await page.goto('/history')
    const card = page.getByRole('link', { name: /Push day/ })
    await expect(card).toContainText('2 × Bench Press')
    await expect(card.locator('.pr-badge')).toHaveCount(0)
  })
})

test.describe('body map hover regression', () => {
  // A real pointer, so (hover: hover) matches and the mouse stays over the
  // tapped region: this reproduced "only one side lights up".
  test.use({ isMobile: false, hasTouch: false })

  test('both sides of a selected muscle light up, even under the pointer', async ({ page }) => {
    await mockSupabase(page, {
      exercises: [
        {
          id: 'e1',
          user_id: null,
          name: 'Bench Press',
          muscle_group: 'chest',
          equipment: 'barbell',
          kind: 'weight_reps',
          image_path: null,
        },
      ],
    })
    await page.goto('/exercises')
    const chest = page.locator('[data-testid="body-map-front"] [data-region="chest"]')
    await chest.first().click() // the pointer now rests on this polygon

    const accent = await page.evaluate(() => {
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      probe.style.fill = 'var(--accent)'
      document.querySelector('svg.body-map')!.appendChild(probe)
      const value = getComputedStyle(probe).fill
      probe.remove()
      return value
    })
    // Poll: the fill has a 0.2 s transition, so read it once it has settled.
    await expect
      .poll(() => chest.evaluateAll((els) => els.map((el) => getComputedStyle(el).fill)))
      .toEqual([accent, accent])
  })
})

test.describe('home', () => {
  test('the tab bar always has all five tabs', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await page.goto('/')
    const tabs = page.getByRole('navigation', { name: 'Main' }).locator('a, button')
    await expect(tabs).toHaveCount(5)
    // No workout yet: the Active tab opens the empty state instead of disappearing.
    await page.getByRole('link', { name: 'Active workout' }).click()
    await expect(page.getByText('No workout in progress.')).toBeVisible()
  })

  test('the week strip marks today and training days, and opens a workout', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0)) // Friday 6 November, local
    await mockSupabase(page, { routines, folders })
    const iso = (d: number, h: number) => new Date(2026, 10, d, h).toISOString()
    // Only the strip's light query (id, started_at), not the weekly muscle query.
    await page.route(/\/rest\/v1\/workouts\?select=id%2Cstarted_at&/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'w-mon', started_at: iso(2, 7) },
          { id: 'w-wed-1', started_at: iso(4, 8) },
          { id: 'w-wed-2', started_at: iso(4, 19) },
        ]),
      }),
    )
    await page.goto('/')

    const strip = page.getByRole('region', { name: 'This week' })
    await expect(strip).toContainText('3 workouts')
    await expect(strip.locator('[aria-current="date"]')).toHaveAttribute(
      'aria-label',
      /6.*today$/, // date format follows the browser locale
    )
    await expect(strip.locator('.day')).toHaveCount(28)
    await expect(strip.locator('.day.trained')).toHaveCount(2)

    // One workout that day → opens it; several → the history list.
    await strip.getByRole('link', { name: '1 workout' }).click()
    await expect(page).toHaveURL(/\/history\/w-mon$/)
    await page.goBack()
    await page.getByRole('link', { name: '2 workouts' }).click()
    await expect(page).toHaveURL(/\/history$/)
  })
})

test('a new page always opens at the top', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await page.getByRole('button', { name: 'Push 2 exercises', exact: true }).click()
  await page.getByRole('button', { name: 'Start Push' }).click() // scrolls Home down to reach it
  await expect(page).toHaveURL(/\/workout$/)
  // The reset runs when React commits the new page; poll instead of reading once.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test.describe('muscle stats', () => {
  const s = (id: string, set_type = 'normal') => ({
    id,
    position: 0,
    set_type,
    weight_kg: 50,
    reps: 10,
    duration_s: null,
    rpe: null,
  })
  const we = (id: string, muscle_group: string, sets: ReturnType<typeof s>[]) => ({
    id,
    exercise_id: bench.id,
    position: 0,
    notes: null,
    exercise: { ...bench, muscle_group },
    sets,
  })
  const thisWeek = {
    id: '00000000-0000-0000-0000-0000000000a1',
    routine_id: null,
    name: 'Upper',
    started_at: new Date(2026, 10, 4, 18).toISOString(), // Wed 4 Nov
    ended_at: new Date(2026, 10, 4, 19).toISOString(),
    notes: null,
    workout_exercises: [
      we('x1', 'mid-chest', [s('a'), s('b'), s('c'), s('d'), s('e', 'warmup')]),
      we('x2', 'upper-chest', [s('f'), s('g'), s('h'), s('i'), s('j'), s('k'), s('l')]),
      we('x3', 'lats', [s('m'), s('n'), s('o')]),
    ],
  }

  test('Home shows this week per group and opens the weekly page', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 6, 10, 0)) // Friday 6 November
    // The mock ignores date filters: any week shows these workouts.
    await mockSupabase(page, { routines, folders, workouts: [thisWeek] })
    await page.goto('/')

    const card = page.getByRole('link', { name: 'Muscles this week' })
    await expect(card).toContainText('1 of 11 groups at 10–20 sets') // chest 11 (warm-up ignored)
    await expect(card.locator('.volume-row')).toHaveCount(2) // only trained groups: chest, back
    await card.click()

    await expect(page).toHaveURL(/\/stats$/)
    await expect(page.locator('.week-nav-title')).toContainText('This week')
    await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled()
    const bars = page.getByRole('region', { name: 'Sets per muscle group' })
    await expect(bars.locator('.volume-row')).toHaveCount(11)
    await expect(bars.locator('.volume-row.ok')).toContainText('Chest')
    await expect(bars.locator('.volume-row.low')).toContainText('Back')
    await expect(bars.getByRole('list', { name: 'Chest by target' })).toContainText('upper chest 7')

    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(page.locator('.week-nav-title')).toContainText('Last week')
    await expect(page.getByRole('button', { name: 'Next week' })).toBeEnabled()
  })
})

/** Me tab → Log out: opens the confirmation. */
async function openLogOut(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' }).click()
  await page.getByRole('dialog', { name: 'Me' }).getByRole('button', { name: 'Log out' }).click()
}

test.describe('log out', () => {
  test('asks first; Cancel keeps the session, Log out goes to the login page', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await page.goto('/')

    await openLogOut(page)
    const dialog = page.getByRole('dialog', { name: 'Log out?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)

    await openLogOut(page)
    await dialog.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the data saved on the phone goes with the session', async ({ page }) => {
    const savedCache = () => page.evaluate(() => localStorage.getItem('gym-tracker-query-cache'))
    await mockSupabase(page, { routines, folders })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Start Push' })).toBeVisible()
    // Saved for a fast start next time (written shortly after the data arrives).
    await expect.poll(savedCache).toContain('Push Pull Legs')

    await openLogOut(page)
    await page
      .getByRole('dialog', { name: 'Log out?' })
      .getByRole('button', { name: 'Log out' })
      .click()
    await expect(page).toHaveURL(/\/login$/)
    // The next person on this phone must not see it.
    await expect.poll(savedCache).toBeNull()
  })
})

async function emptyWorkoutWithBench(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  await page.getByRole('button', { name: /^Show all/ }).click()
  await page.getByRole('button', { name: `Select ${bench.name}` }).click()
  await page.getByRole('button', { name: 'Add 1 exercise' }).click()
  return page.getByRole('region', { name: bench.name })
}

test.describe('progression suggestion', () => {
  test('easy last time (RPE 7): more load; Apply fills only empty sets', async ({ page }) => {
    await mockSupabase(page, { previous: { weight_kg: 80, reps: 8, rpe: 7 } })
    const card = await emptyWorkoutWithBench(page)

    await expect(card.locator('.suggestion')).toContainText('Try 82.5 kg × 8')
    await expect(card.locator('.suggestion')).toContainText('RPE 7 last time')
    await card.getByRole('button', { name: `Apply suggestion for ${bench.name}` }).click()
    await expect(card.getByLabel('Set 1 weight')).toHaveValue('82.5')
    await expect(card.getByLabel('Set 1 reps')).toHaveValue('8')
    // Nothing left to fill.
    await expect(
      card.getByRole('button', { name: `Apply suggestion for ${bench.name}` }),
    ).toBeDisabled()
  })

  test('without RPE: one more rep, and typed values are kept', async ({ page }) => {
    await mockSupabase(page, { previous: { weight_kg: 80, reps: 8 } })
    const card = await emptyWorkoutWithBench(page)

    await expect(card.locator('.suggestion')).toContainText('Try 80 kg × 9')
    await card.getByLabel('Set 1 weight').fill('77,5')
    await card.getByRole('button', { name: `Apply suggestion for ${bench.name}` }).click()
    await expect(card.getByLabel('Set 1 weight')).toHaveValue('77,5')
    await expect(card.getByLabel('Set 1 reps')).toHaveValue('9')
  })

  test('no history: no suggestion', async ({ page }) => {
    await mockSupabase(page)
    const card = await emptyWorkoutWithBench(page)
    await expect(card.locator('.suggestion')).toHaveCount(0)
  })
})

test.describe('in-app dialogs', () => {
  test('remove, finish and discard ask in the app, and Cancel changes nothing', async ({
    page,
  }) => {
    await mockSupabase(page)
    const card = await emptyWorkoutWithBench(page)

    // Finish with nothing ticked: an inline hint, no dialog.
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page.getByRole('alert')).toContainText('Tick at least one set')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await exerciseAction(page, bench.name, 'Remove exercise')
    const remove = page.getByRole('dialog', { name: `Remove ${bench.name}?` })
    await remove.getByRole('button', { name: 'Cancel' }).click()
    await expect(card).toBeVisible()

    await page.getByRole('button', { name: 'Discard' }).click()
    const discard = page.getByRole('dialog', { name: 'Discard this workout?' })
    await expect(discard).toContainText('Nothing will be saved.')
    await discard.getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Resume workout')).toHaveCount(0)
  })

  test('a new folder is named in an in-app prompt; empty names are refused', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    const saved: unknown[] = []
    await page.route(/\/rest\/v1\/routine_folders/, (r) => {
      if (r.request().method() === 'POST') saved.push(r.request().postDataJSON())
      return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    })
    await page.goto('/')
    await page.getByRole('button', { name: '+ Folder' }).click()

    const prompt = page.getByRole('dialog', { name: 'New folder' })
    const create = prompt.getByRole('button', { name: 'Create' })
    await expect(create).toBeDisabled()
    await prompt.getByLabel('Folder name').fill('  Arms  ')
    await create.click()
    await expect(prompt).toBeHidden()
    await expect.poll(() => saved).toEqual([expect.objectContaining({ name: 'Arms' })])
  })
})

test.describe('routine actions', () => {
  const sheet = (page: Page) => page.getByRole('dialog', { name: 'Push' })
  const openMenu = (page: Page) =>
    page.getByRole('button', { name: 'More actions for Push' }).click()

  test('Edit opens the editor; Duplicate saves a copy in the same folder', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    const saved: { p: { name: string; folder_id: string; exercises: unknown[] } }[] = []
    await page.route(/\/rest\/v1\/rpc\/save_routine/, (r) => {
      saved.push(r.request().postDataJSON())
      return r.fulfill({ status: 200, contentType: 'application/json', body: '"r-copy"' })
    })
    await page.goto('/')

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Duplicate routine' }).click()
    await expect(sheet(page)).toBeHidden()
    expect(saved).toHaveLength(1)
    expect(saved[0].p).toMatchObject({ name: 'Push (copy)', folder_id: 'f-ppl' })
    expect(saved[0].p.exercises).toHaveLength(2)

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Edit routine' }).click()
    await expect(page).toHaveURL(/\/routines\/r-push$/)
  })

  test('Share uses the share sheet when there is one', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          ;(window as unknown as { shared: ShareData }).shared = data
        },
      })
    })
    await mockSupabase(page, { routines, folders })
    await page.goto('/')

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Share routine' }).click()
    await expect(sheet(page)).toBeHidden()
    const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared)
    expect(shared.title).toBe('Push')
    expect(shared.text).toContain('1. Bench Press — 3 sets')
  })

  test('Share falls back to the clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            ;(window as unknown as { copied: string }).copied = text
          },
        },
      })
    })
    await mockSupabase(page, { routines, folders })
    await page.goto('/')

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Share routine' }).click()
    await expect(sheet(page).getByRole('status')).toHaveText('Copied to the clipboard.')
    expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
      'Overhead Press',
    )
  })

  test('Delete asks first, then deletes', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    const deleted: string[] = []
    await page.route(/\/rest\/v1\/routines\?id=eq\./, (r) => {
      if (r.request().method() === 'DELETE') deleted.push(r.request().url())
      return r.fulfill({ status: 204 })
    })
    await page.goto('/')

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Delete routine' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete routine "Push"?' })
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    expect(deleted).toHaveLength(0)

    await openMenu(page)
    await sheet(page).getByRole('button', { name: 'Delete routine' }).click()
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect.poll(() => deleted.length).toBe(1)
    expect(deleted[0]).toContain('id=eq.r-push')
  })
})

test('the picker keeps "Show" on screen after picking a muscle group', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()

  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  await picker.getByRole('button', { name: 'Back', exact: true }).first().click() // opens 4 sub-chips
  // The main filter button ("Show N" or "No exercises match") stays on screen.
  await expect(picker.locator('.filter-actions .btn.primary')).toBeInViewport()
  // The Add bar belongs to the results step only.
  await expect(picker.getByRole('button', { name: /^Add .*exercise/ })).toHaveCount(0)
})

test.describe('exercise card actions', () => {
  test('Replace keeps the set rows, clears the numbers, and asks when sets are logged', async ({
    page,
  }) => {
    await mockSupabase(page, { routines, folders, exercises: [bench, customCurl] })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByRole('button', { name: '+ Add set' }).click()
    await card.getByLabel('Set 1 weight').fill('60')
    await card.getByLabel('Set 1 reps').fill('10')
    await card.getByRole('button', { name: 'Set 1 done' }).click()

    await exerciseAction(page, bench.name, 'Replace exercise')
    const picker = page.getByRole('dialog', { name: `Replace ${bench.name}` })
    await picker.getByRole('button', { name: /^Show all/ }).click()
    await picker.getByRole('button', { name: 'Choose My Cable Curl' }).click()

    // One set was ticked: confirm before its numbers go.
    const ask = page.getByRole('dialog', { name: `Replace ${bench.name}?` })
    await expect(ask).toContainText('1 logged set is cleared')
    await ask.getByRole('button', { name: 'Replace' }).click()

    const curl = page.getByRole('region', { name: 'My Cable Curl' })
    await expect(curl.getByLabel('Set 1 weight')).toHaveValue('')
    await expect(curl.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(curl.getByLabel('Set 2 weight')).toBeVisible() // still 2 rows
    // Same slot: still first.
    await expect(page.locator('.exercise-title').first()).toHaveText('My Cable Curl')
  })

  test('the reorder sheet moves and removes exercises', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    await exerciseAction(page, bench.name, 'Reorder exercises')

    const sheet = page.getByRole('dialog', { name: 'Reorder' })
    const rows = sheet.locator('.reorder-name')
    await expect(rows).toHaveText(['Bench Press', 'Overhead Press'])
    const moveDown = sheet.getByRole('button', { name: 'Move Bench Press down' })
    await moveDown.focus()
    await page.keyboard.press('Enter')
    await expect(rows).toHaveText(['Overhead Press', 'Bench Press'])

    // Nothing logged yet: removed without a question.
    await sheet.getByRole('button', { name: 'Remove Overhead Press' }).click()
    await expect(rows).toHaveText(['Bench Press'])

    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.locator('.exercise-title')).toHaveText(['Bench Press'])
  })

  test('notes open on demand; rest time sits next to them', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })

    await expect(card.getByLabel(`Notes for ${bench.name}`)).toHaveCount(0)
    await expect(card.getByLabel(`Rest time for ${bench.name}`)).toBeVisible()
    await card.getByRole('button', { name: 'Notes' }).click()
    const notes = card.getByLabel(`Notes for ${bench.name}`)
    await expect(notes).toBeFocused()
    await notes.fill('Elbows in')
    await card.getByRole('button', { name: 'Notes' }).click()
    await expect(notes).toHaveCount(0)
    await card.getByRole('button', { name: /Notes/ }).click()
    await expect(card.getByLabel(`Notes for ${bench.name}`)).toHaveValue('Elbows in')
  })

  test('kg and reps above 1000 are flagged and cannot be ticked', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })

    await card.getByLabel('Set 1 weight').fill('8000')
    await card.getByLabel('Set 1 reps').fill('8')
    await expect(card.getByRole('alert')).toContainText('at most 1000')
    await expect(card.getByLabel('Set 1 weight')).toHaveAttribute('aria-invalid', 'true')

    await card.getByRole('button', { name: 'Set 1 done' }).click()
    await expect(card.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(card.getByLabel('Set 1 weight')).toBeFocused()

    await card.getByLabel('Set 1 weight').fill('80')
    await expect(card.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('workout header and timers', () => {
  test('the header sticks with the totals and Finish; workout notes are gone', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('80')
    await card.getByLabel('Set 1 reps').fill('8')
    await card.getByRole('button', { name: 'Set 1 done' }).click()

    const bar = page.locator('.workout-bar')
    await expect(bar).toContainText('640 kg')
    await expect(page.getByLabel('Workout notes')).toHaveCount(0)

    await page.getByRole('button', { name: /^Discard/ }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeInViewport()
    await expect(bar).toBeInViewport()
  })

  test('rest time is picked on a wheel (keyboard works too)', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })

    await card.getByRole('button', { name: /Rest time for Bench Press/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Rest timer' })
    const wheel = sheet.getByRole('spinbutton', { name: 'Rest time for Bench Press' })
    await expect(wheel).toHaveAttribute('aria-valuetext', '1 min 30 s')
    await wheel.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(wheel).toHaveAttribute('aria-valuetext', '2 min')
    await sheet.getByRole('button', { name: 'Done' }).click()

    await expect(card.getByRole('button', { name: /Rest time for Bench Press/ })).toHaveText(
      /Rest 2:00/,
    )
  })

  test.describe('on a slow phone, where the wheel lags behind a pick', () => {
    const ROW = 44 // TimeWheel's ITEM_HEIGHT

    test.beforeEach(async ({ page }) => {
      // The smooth scroll stalls one row short of where it is going, as when
      // a busy phone drops frames (on a row, so scroll snap leaves it there).
      // Only the wheel calls element.scrollTo.
      await page.addInitScript((row) => {
        Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
          const top = typeof options === 'object' ? (options.top ?? 0) : 0
          this.scrollTop = top - Math.sign(top - this.scrollTop) * row
        } as Element['scrollTo']
      }, ROW)
      await mockSupabase(page, { routines, folders })
      await startPush(page)
      await page.getByRole('button', { name: /Rest time for Bench Press/ }).click()
    })

    test('a key press is not undone while the wheel catches up', async ({ page }) => {
      const sheet = page.getByRole('dialog', { name: 'Rest timer' })
      const wheel = sheet.getByRole('spinbutton', { name: 'Rest time for Bench Press' })
      await wheel.focus()
      await page.keyboard.press('PageDown') // 1:30 → 2:30; the wheel stops at 2:15
      await expect(wheel).toHaveAttribute('aria-valuetext', '2 min 30 s')
      // Longer than the wheel's 120 ms settle delay, the time a position still
      // on its way would need to overwrite the pick.
      await page.waitForTimeout(300)
      await sheet.getByRole('button', { name: 'Done' }).click()

      await expect(
        page.getByRole('region', { name: bench.name }).getByRole('button', {
          name: /Rest time for Bench Press/,
        }),
      ).toHaveText(/Rest 2:30/)
    })

    test('scrolling by hand still picks after a key press', async ({ page }) => {
      const wheel = page
        .getByRole('dialog', { name: 'Rest timer' })
        .getByRole('spinbutton', { name: 'Rest time for Bench Press' })
      await wheel.focus()
      await page.keyboard.press('PageDown')
      await expect(wheel).toHaveAttribute('aria-valuetext', '2 min 30 s')

      // A finger takes over and drags the wheel to 3:00 (row 12). Playwright
      // has no touch scrolling in mobile WebKit, so: pointer down, then move.
      await wheel.dispatchEvent('pointerdown')
      await wheel.evaluate((el, top) => (el.scrollTop = top), 12 * ROW)
      await expect(wheel).toHaveAttribute('aria-valuetext', '3 min')
    })
  })

  test('the ⏱ sheet starts a countdown and runs a stopwatch', async ({ page }) => {
    await page.clock.install()
    await mockSupabase(page, { routines, folders })
    await startPush(page)

    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Timer' })
    await sheet.getByRole('button', { name: 'Start 1:00' }).click()
    const timer = page.locator('.rest-timer')
    await expect(timer).toContainText('1:00')
    await expect(timer.locator('.rest-progress')).toBeVisible()

    // The last seconds look different, and rest over is not a solid lime slab.
    await page.clock.runFor(56_000)
    await expect(timer).toHaveClass(/ending/)
    await page.clock.runFor(5_000)
    await expect(timer).toHaveClass(/done/)
    await expect(timer).toContainText('Rest over')
    await timer.getByRole('button', { name: 'Close' }).click()

    await page.getByRole('button', { name: 'Timer', exact: true }).click()
    await sheet.getByRole('tab', { name: 'Stopwatch' }).click()
    await sheet.getByRole('button', { name: 'Start' }).click()
    await page.clock.runFor(3_200)
    // About 3 s (a few ms pass between the click and the fast-forward).
    await expect(sheet.getByRole('timer')).toHaveText(/^0:03\.\d$/)
    await sheet.getByRole('button', { name: 'Pause' }).click()
    const paused = await sheet.getByRole('timer').textContent()
    await page.clock.runFor(5_000)
    await expect(sheet.getByRole('timer')).toHaveText(paused!) // frozen while paused

    // Running in the background shows on the header button.
    await sheet.getByRole('button', { name: 'Resume' }).click()
    await page.keyboard.press('Escape')
    // Seconds, not tenths: a slow runner may have moved on a little since the pause.
    await expect(page.getByRole('button', { name: /stopwatch at 0:0\d\)$/ })).toBeVisible()
  })
})

test.describe('live workout bar', () => {
  test('follows the user across tabs and leads back to the workout', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const bar = page.getByRole('link', { name: /^Resume workout: Push, \d+:\d\d$/ })
    // Not on the workout itself: it is already on screen there.
    await expect(bar).toHaveCount(0)

    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(bar).toBeVisible()
    await page.getByRole('link', { name: 'Exercises' }).click()
    await expect(bar).toBeVisible()
    await page.getByRole('link', { name: 'Workout', exact: true }).click()
    await expect(bar).toBeVisible()

    await bar.click()
    await expect(page).toHaveURL(/\/workout$/)
    await expect(bar).toHaveCount(0)
  })

  test('shows the rest countdown while resting', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: 'Bench Press' })
    await card.getByLabel('Set 1 weight').fill('60')
    await card.getByLabel('Set 1 reps').fill('8')
    await card.getByRole('button', { name: 'Set 1 done' }).click()

    await page.getByRole('link', { name: 'History' }).click()
    await expect(
      page.getByRole('link', { name: /^Resume workout: Push, Rest \d+:\d\d$/ }),
    ).toBeVisible()
  })
})

test.describe('plate calculator', () => {
  test('opens on the next set and shows the plates per side', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await startPush(page)
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('82,5')

    await exerciseAction(page, bench.name, 'Plate calculator')
    const sheet = page.getByRole('dialog', { name: 'Plate calculator' })
    await expect(sheet.getByLabel('Total weight (kg)')).toHaveValue('82.5')
    await expect(sheet.getByText('Each side:')).toContainText('25 + 5 + 1.25')

    // Another bar, and a weight the plates can't make exactly.
    await sheet.getByRole('button', { name: '15 kg' }).click()
    await expect(sheet.getByRole('button', { name: '15 kg' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await sheet.getByLabel('Total weight (kg)').fill('64')
    await expect(sheet.getByText('Each side:')).toContainText('20 + 2.5 + 1.25')
    await expect(sheet).toContainText("1.5 kg can't be made with these plates: this loads 62.5 kg.")
  })

  test('is only offered for barbell lifts with weight', async ({ page }) => {
    await mockSupabase(page, { routines, folders })
    await page.goto('/')
    await page.getByRole('button', { name: 'Start Pull' }).click()
    await page.getByRole('button', { name: `More actions for ${pullUp.name}` }).click()
    const menu = page.getByRole('dialog', { name: pullUp.name })
    await expect(menu.getByRole('button', { name: 'Replace exercise' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Plate calculator' })).toHaveCount(0)
  })
})
