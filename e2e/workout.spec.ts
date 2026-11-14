import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, mockSupabase } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

test('logs a workout, survives a reload and saves only completed sets', async ({ page }) => {
  const api = await mockSupabase(page, { previous: { weight_kg: 80, reps: 8 } })

  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await expect(page).toHaveURL(/\/workout$/)

  await page.getByRole('button', { name: '+ Add exercises' }).click()
  // The picker opens on the filter step; skip it.
  await page.getByRole('button', { name: /^Show all/ }).click()
  await page.getByRole('button', { name: `Select ${bench.name}` }).click()
  await page.getByRole('button', { name: 'Add 1 exercise' }).click()

  const card = page.getByRole('region', { name: bench.name })
  await expect(card.getByRole('cell', { name: '80 kg × 8' })).toBeVisible()

  // Comma decimal, as typed on an iPhone with a Vietnamese keyboard; reps left empty.
  await card.getByLabel('Set 1 weight').fill('82,5')
  await card.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(card.getByLabel('Set 1 reps')).toHaveValue('8') // filled from last time
  await expect(page.getByRole('timer')).toBeVisible()

  // A second set that is never ticked must not be saved.
  await card.getByRole('button', { name: '+ Add set' }).click()
  await expect(card.getByLabel('Set 2 weight')).toHaveValue('82,5')

  await page.reload()
  await expect(card.getByLabel('Set 1 weight')).toHaveValue('82,5')
  await expect(card.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'Finish workout' }).click()
  // Set 2 is unticked: the app asks before dropping it.
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('cell', { name: '82.5 kg × 8' })).toBeVisible()

  expect(api.saved).toHaveLength(1)
  expect(api.saved[0].exercises).toEqual([
    {
      exercise_id: bench.id,
      notes: null,
      sets: [{ set_type: 'normal', weight_kg: 82.5, reps: 8, duration_s: null, rpe: null }],
    },
  ])

  // The draft is gone once saved.
  await page.goto('/')
  await expect(page.getByText('Resume workout')).toHaveCount(0)
})

test('keeps the draft on the phone when saving fails', async ({ page }) => {
  await mockSupabase(page)
  let attempts = 0
  await page.route('**/rest/v1/rpc/save_workout', (r) => {
    attempts++
    return r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'boom' }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  // The picker opens on the filter step; skip it.
  await page.getByRole('button', { name: /^Show all/ }).click()
  await page.getByRole('button', { name: `Select ${bench.name}` }).click()
  await page.getByRole('button', { name: 'Add 1 exercise' }).click()
  const card = page.getByRole('region', { name: bench.name })
  await card.getByLabel('Set 1 weight').fill('60')
  await card.getByLabel('Set 1 reps').fill('10')
  await card.getByRole('button', { name: 'Set 1 done' }).click()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('alert')).toContainText('Your workout is still on this phone')
  await expect(page).toHaveURL(/\/workout$/)
  await expect(card.getByLabel('Set 1 weight')).toHaveValue('60')
  // An answer from the server would fail the same way again: not retried.
  await page.waitForTimeout(1500)
  expect(attempts).toBe(1)
})

test.describe('with a weak or lost signal', () => {
  /** An empty workout with one ticked bench set of 60 × 10; returns its card. */
  async function oneTickedSet(page: Page) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercises' }).click()
    await page.getByRole('button', { name: /^Show all/ }).click()
    await page.getByRole('button', { name: `Select ${bench.name}` }).click()
    await page.getByRole('button', { name: 'Add 1 exercise' }).click()
    const card = page.getByRole('region', { name: bench.name })
    await card.getByLabel('Set 1 weight').fill('60')
    await card.getByLabel('Set 1 reps').fill('10')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    return card
  }

  const SAVED_URL = /\/history\/[0-9a-f-]{36}$/
  // The page has other live regions (drag announcements, the PR banner).
  const noSignal = (page: Page) => page.getByRole('status').filter({ hasText: 'No signal' })

  test('offline, Finish waits and saves once the phone is back online', async ({
    page,
    context,
  }) => {
    const api = await mockSupabase(page)
    await oneTickedSet(page)

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(noSignal(page)).toContainText('will be saved when you')
    await expect(page.getByRole('button', { name: 'Finish workout' })).toHaveText(
      'Waiting for signal…',
    )
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(api.saved).toHaveLength(0)

    await context.setOffline(false)
    await expect(page).toHaveURL(SAVED_URL)
    expect(api.saved).toHaveLength(1)
  })

  test('a request lost on the way is sent again, and saved once', async ({ page }) => {
    const api = await mockSupabase(page)
    let attempts = 0
    // The first try never gets an answer; the next ones reach the mock.
    await page.route('**/rest/v1/rpc/save_workout', (r) =>
      ++attempts === 1 ? r.abort('internetdisconnected') : r.fallback(),
    )
    await oneTickedSet(page)

    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(page).toHaveURL(SAVED_URL)
    expect(attempts).toBe(2)
    expect(api.saved).toHaveLength(1)
  })

  test('edits made while waiting are saved too, as the same workout', async ({ page, context }) => {
    const api = await mockSupabase(page)
    const card = await oneTickedSet(page)

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await expect(noSignal(page)).toBeVisible()
    await card.getByLabel('Set 1 reps').fill('12')

    await context.setOffline(false)
    await expect(page).toHaveURL(SAVED_URL)
    expect(api.saved).toHaveLength(1) // same id: replaced, not added
    expect(api.saved[0].exercises[0].sets[0]).toMatchObject({ weight_kg: 60, reps: 12 })
  })
})
