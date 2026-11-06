import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

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
