import { expect, test, type Page } from '@playwright/test'
import { bench, customCurl, fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

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

test('reorders exercises with the keyboard (same sensor as touch drag)', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await startPush(page)
  const titles = page.locator('.exercise-title')
  await expect(titles).toHaveText(['Bench Press', 'Overhead Press'])

  await page.getByRole('button', { name: 'Reorder Bench Press' }).focus()
  // dnd-kit announces each step; waiting on the announcement (not a timeout)
  // makes sure the drop happens after the move was processed.
  const live = page.locator('[id^="DndLiveRegion"]')
  await page.keyboard.press('Space')
  await expect(live).toContainText('Bench Press moved to position 1 of 2.') // picked up, still in place
  await page.keyboard.press('ArrowDown')
  await expect(live).toContainText('Bench Press moved to position 2 of 2.')
  await page.keyboard.press('Space')
  await expect(live).toContainText('Bench Press dropped at position 2 of 2.')

  await expect(titles).toHaveText(['Overhead Press', 'Bench Press'])
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

    const toggle = card.getByRole('button', { name: /Bench Press 1\/3 sets/ })
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

    const live = page.locator('[id^="DndLiveRegion"]')
    await page.getByRole('button', { name: 'Reorder Bench Press' }).focus()
    await page.keyboard.press('Space')
    await expect(live).toContainText('Bench Press moved to position 1 of 2.')
    await page.keyboard.press('ArrowDown')
    await expect(live).toContainText('Bench Press moved to position 2 of 2.')
    await page.keyboard.press('Space')
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
