import { expect, test, type Page } from '@playwright/test'
import { fakeLogin, mockSupabase, user, type BodyWeightRow } from './mockSupabase'

// A fixed "today" (local time), so ranges and the date field are predictable.
const TODAY = '2026-11-15'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`))
})

async function openMe(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' }).click()
  return page.getByRole('dialog', { name: 'Me' })
}

const form = (page: Page) => page.getByRole('form', { name: 'Log a weigh-in' })
const weighIns = (page: Page) =>
  page.getByRole('region', { name: 'Weigh-ins' }).getByRole('listitem')

test('opens from Me, starts empty, and logs a weigh-in typed with a comma', async ({ page }) => {
  const api = await mockSupabase(page)
  await page.goto('/')
  const me = await openMe(page)
  await me.getByRole('link', { name: 'Body weight' }).click()

  await expect(page).toHaveURL(/\/body-weight$/)
  await expect(page.getByRole('dialog', { name: 'Me' })).toHaveCount(0) // the sheet closed
  await expect(page.getByText('No weigh-ins yet.')).toBeVisible()
  await expect(form(page).getByLabel('Day')).toHaveValue(TODAY)

  await form(page).getByLabel('Weight (kg)').fill('78,4')
  await form(page).getByRole('button', { name: 'Save weigh-in' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  // The iPhone profile's locale is en-US.
  await expect(weighIns(page)).toHaveText([/Nov 15, 2026.*78\.4 kg/])
  await expect(form(page).getByLabel('Weight (kg)')).toHaveValue('')
  expect(api.bodyWeightWrites).toEqual([
    expect.objectContaining({ user_id: user.id, measured_on: TODAY, weight_kg: 78.4 }),
  ])
})

test('a second weigh-in on the same day replaces the first', async ({ page }) => {
  const api = await mockSupabase(page, { bodyWeights: [{ measured_on: TODAY, weight_kg: 80 }] })
  await page.goto('/body-weight')

  await expect(form(page)).toContainText('Replaces 80 kg logged that day.')
  await form(page).getByLabel('Weight (kg)').fill('79.5')
  await form(page).getByRole('button', { name: 'Save weigh-in' }).click()

  await expect(weighIns(page)).toHaveText([/79\.5 kg/])
  expect(api.bodyWeights).toEqual([{ measured_on: TODAY, weight_kg: 79.5 }])
})

test('an lb account logs in lb and the database gets kg', async ({ page }) => {
  const api = await mockSupabase(page, { unit: 'lb' })
  await page.goto('/body-weight')

  await form(page).getByLabel('Weight (lb)').fill('176')
  await form(page).getByRole('button', { name: 'Save weigh-in' }).click()

  await expect(weighIns(page)).toHaveText([/176 lb/])
  // The kg value that shows as 176 lb again, not 79.83.
  expect(api.bodyWeightWrites[0].weight_kg).toBe(79.85)
})

test('a typo or a future day is refused before anything is sent', async ({ page }) => {
  const api = await mockSupabase(page)
  await page.goto('/body-weight')
  const weight = form(page).getByLabel('Weight (kg)')

  await weight.fill('7.8')
  await form(page).getByRole('button', { name: 'Save weigh-in' }).click()
  await expect(form(page).getByRole('alert')).toHaveText('Enter a weight between 20 and 400 kg.')
  await expect(weight).toHaveAttribute('aria-invalid', 'true')

  await weight.fill('78')
  await form(page).getByLabel('Day').fill('2026-11-16')
  await form(page).getByRole('button', { name: 'Save weigh-in' }).click()
  await expect(form(page).getByRole('alert')).toHaveText('That day has not happened yet.')

  expect(api.bodyWeightWrites).toEqual([])
})

test('the trend follows the picked range', async ({ page }) => {
  const log: BodyWeightRow[] = [
    { measured_on: '2025-06-01', weight_kg: 85 },
    { measured_on: '2026-11-14', weight_kg: 79.2 },
    { measured_on: '2026-08-15', weight_kg: 80.5 },
  ]
  await mockSupabase(page, { bodyWeights: log })
  await page.goto('/body-weight')

  // Default: the last 3 months, from 15 Aug (the boundary day counts).
  await expect(page.getByRole('button', { name: '3 months' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('paragraph').filter({ hasText: '79.2 kg' })).toContainText(
    'Nov 14, 2026',
  )
  await expect(page.getByText('−1.3 kg in 3 months')).toBeVisible()
  await expect(page.getByRole('figure', { name: 'Body weight (kg), 3 months' })).toBeVisible()

  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.getByText('−5.8 kg overall')).toBeVisible()
  // Newest first.
  await expect(weighIns(page)).toHaveText([/79\.2 kg/, /80\.5 kg/, /85 kg/])
})

test('deleting asks first, and Cancel keeps the weigh-in', async ({ page }) => {
  const api = await mockSupabase(page, { bodyWeights: [{ measured_on: TODAY, weight_kg: 80 }] })
  await page.goto('/body-weight')
  const remove = page.getByRole('button', { name: /^Delete weigh-in of / })

  await remove.click()
  const dialog = page.getByRole('dialog', { name: 'Delete this weigh-in?' })
  await expect(dialog).toContainText('80 kg on')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(weighIns(page)).toHaveCount(1)

  await remove.click()
  await page
    .getByRole('dialog', { name: 'Delete this weigh-in?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('No weigh-ins yet.')).toBeVisible()
  expect(api.bodyWeights).toEqual([])
})

test('a failed load says why and can be tried again', async ({ page }) => {
  await mockSupabase(page)
  let fail = true
  await page.route('**/rest/v1/body_weights*', (r) =>
    fail ? r.fulfill({ status: 500, json: { message: 'Database is down' } }) : r.fallback(),
  )
  await page.goto('/body-weight')

  // The form still works while the list could not load.
  await expect(form(page)).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Database is down', { timeout: 10_000 })
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('No weigh-ins yet.')).toBeVisible()
})

test('exports the weigh-ins as their own CSV file', async ({ page }) => {
  await mockSupabase(page, {
    unit: 'lb',
    bodyWeights: [
      { measured_on: '2026-11-14', weight_kg: 79.2 },
      { measured_on: '2026-08-15', weight_kg: 80.5 },
    ],
  })
  await page.goto('/')
  const me = await openMe(page)

  await me.getByRole('button', { name: 'Export body weight (CSV)' }).click()
  await expect(me).toContainText('2 weigh-ins, in lb.')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    me.getByRole('button', { name: `Save gym-tracker-body-weight-${TODAY}.csv` }).click(),
  ])
  await expect(me).toContainText('Exported.')

  const { readFile } = await import('node:fs/promises')
  const text = await readFile(await download.path(), 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff) // BOM, for Excel
  const csv = text.slice(1)
  expect(csv.trimEnd().split('\r\n')).toEqual([
    'Date,Weight (lb)',
    '2026-08-15,177.5',
    '2026-11-14,174.6',
  ])
})
