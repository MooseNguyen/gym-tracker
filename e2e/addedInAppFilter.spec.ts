import { expect, test, type Page } from '@playwright/test'
import { bench, customCurl, fakeLogin, mockSupabase } from './mockSupabase'

// A built-in an admin added from the app: shown to everyone, not from RepDB.
const adminPulldown = {
  id: 'ex-admin-pulldown',
  user_id: null,
  name: 'Iso-Lateral Pulldown',
  muscle_group: 'lats',
  equipment: 'machine',
  kind: 'weight_reps',
  image_path: null,
  image_path_end: null,
  added_in_app: true,
}
const library = [bench, adminPulldown, customCurl]

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

const addedInApp = (page: Page) => page.getByRole('button', { name: 'Added in app', exact: true })
const listed = (page: Page) => page.locator('.list-item')

test('the Exercises page shows only exercises added in the app', async ({ page }) => {
  await mockSupabase(page, { exercises: library })
  await page.goto('/exercises')

  await expect(addedInApp(page)).toHaveAttribute('aria-pressed', 'false')
  await addedInApp(page).click()
  await expect(addedInApp(page)).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Show 2 exercises' }).click()

  await expect(listed(page)).toHaveText([/Iso-Lateral Pulldown/, /My Cable Curl/])
  await expect(page.getByText(bench.name)).toHaveCount(0)

  // Removing it from the results bar brings the whole library back.
  await page.getByRole('button', { name: 'Remove filter Added in app' }).click()
  await expect(listed(page)).toHaveCount(3)
})

test('it combines with the muscle filter, the search and Clear', async ({ page }) => {
  await mockSupabase(page, { exercises: library })
  await page.goto('/exercises')

  await addedInApp(page).click()
  await page
    .getByRole('list', { name: 'Muscle groups' })
    .getByRole('button', { name: 'Back' })
    .click()
  await page.getByRole('button', { name: 'Show 1 exercise' }).click()
  await expect(listed(page)).toHaveText([/Iso-Lateral Pulldown/])

  await page.getByRole('button', { name: '← Filters' }).click()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(addedInApp(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Show all 3' })).toBeVisible()

  await addedInApp(page).click()
  await page.getByLabel('Search exercises').fill('curl')
  await expect(listed(page)).toHaveText([/My Cable Curl/])
  await page.getByLabel('Search exercises').fill('bench')
  await expect(
    page.getByText('No exercises match. Change the filters or the search.'),
  ).toBeVisible()
})

test('it says so when nothing has been added in the app yet', async ({ page }) => {
  await mockSupabase(page, { exercises: [bench] })
  await page.goto('/exercises')

  await addedInApp(page).click()
  await expect(
    page.getByRole('button', { name: 'No exercises added in the app yet' }),
  ).toBeDisabled()

  await page.getByLabel('Search exercises').fill('press')
  await expect(page.getByText('No exercises have been added in the app yet.')).toBeVisible()
})

test('the workout exercise picker has the same filter', async ({ page }) => {
  await mockSupabase(page, { exercises: library })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()

  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  await picker.getByRole('button', { name: 'Added in app', exact: true }).click()
  await picker.getByRole('button', { name: 'Show 2 exercises' }).click()
  await expect(picker.getByRole('button', { name: `Select ${bench.name}` })).toHaveCount(0)
  await picker.getByRole('button', { name: `Select ${adminPulldown.name}` }).click()
  await picker.getByRole('button', { name: 'Add 1 exercise' }).click()

  await expect(page.getByRole('region', { name: adminPulldown.name })).toBeVisible()
})
