import { expect, test } from '@playwright/test'
import { bench, fakeLogin, mockSupabase } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
  // Every confirm() in this flow is answered "yes".
  page.on('dialog', (d) => d.accept())
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
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  await expect(page.getByText('82.5 kg × 8')).toBeVisible()

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
  await page.route('**/rest/v1/rpc/save_workout', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'boom' }),
    }),
  )

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
})
