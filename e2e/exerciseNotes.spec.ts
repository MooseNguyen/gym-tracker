import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

const benchCard = (page: Page) => page.getByRole('region', { name: bench.name })
const cardNote = (page: Page) =>
  benchCard(page).getByRole('button', { name: /^Note for Bench Press:/ })
const pinChip = (page: Page) =>
  benchCard(page).getByRole('button', { name: 'Pin a note to Bench Press, shown every time' })

async function startPush(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Push' }).click()
  await expect(benchCard(page)).toBeVisible()
}

async function openHowTo(page: Page) {
  await page.getByRole('button', { name: 'More actions for Bench Press' }).click()
  await page
    .getByRole('dialog', { name: bench.name })
    .getByRole('button', { name: 'How to do it' })
    .click()
  return page.getByRole('dialog', { name: 'How to: Bench Press' })
}

test('a pinned note shows on the card and stays for the next time', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  await expect(cardNote(page)).toHaveCount(0)

  await pinChip(page).click()
  const sheet = page.getByRole('dialog', { name: 'Exercise note' })
  const box = sheet.getByLabel('Note for Bench Press')
  await expect(box).toHaveAttribute('maxlength', '200')
  await box.fill('  seat on 4\nwide grip  ')
  await expect(sheet.getByText('23/200')).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()

  await expect(sheet).toBeHidden()
  await expect(cardNote(page)).toContainText('seat on 4')
  await expect(pinChip(page)).toHaveCount(0)
  await expect
    .poll(() => api.exerciseNoteWrites)
    .toEqual([{ exercise_id: bench.id, note: 'seat on 4\nwide grip' }])

  // From the server, not the saved query cache (written at most once a second).
  await page.evaluate(() => localStorage.removeItem('gym-tracker-query-cache'))
  await page.reload()
  await expect(cardNote(page)).toContainText('wide grip')
})

test('the note is edited in How-to and removed from the card', async ({ page }) => {
  const api = await mockSupabase(page, {
    routines,
    folders,
    exerciseNotes: [{ exercise_id: bench.id, note: 'seat on 4' }],
  })
  await startPush(page)
  await expect(cardNote(page)).toContainText('seat on 4')

  const howTo = await openHowTo(page)
  await expect(howTo.getByText('seat on 4')).toBeVisible()
  await howTo.getByRole('button', { name: 'Edit note' }).click()
  // Unchanged text: nothing to save.
  await expect(howTo.getByRole('button', { name: 'Save' })).toBeDisabled()
  await howTo.getByLabel('Note for Bench Press').fill('seat on 5')
  await howTo.getByRole('button', { name: 'Save' }).click()
  await expect(howTo.getByText('seat on 5')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(cardNote(page)).toContainText('seat on 5')
  await cardNote(page).click()
  const sheet = page.getByRole('dialog', { name: 'Exercise note' })
  await expect(sheet.getByLabel('Note for Bench Press')).toHaveValue('seat on 5')
  await sheet.getByRole('button', { name: 'Remove note' }).click()

  await expect(cardNote(page)).toHaveCount(0)
  await expect(pinChip(page)).toBeVisible()
  await expect
    .poll(() => api.exerciseNoteWrites)
    .toEqual([
      { exercise_id: bench.id, note: 'seat on 5' },
      { exercise_id: bench.id, note: null },
    ])
})

test('a note the server refuses goes back, says so, and Retry saves it', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  let refuse = true
  // Registered after mockSupabase: this route is asked first.
  await page.route('**/rest/v1/exercise_notes*', async (route) => {
    if (route.request().method() === 'POST' && refuse) {
      refuse = false
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'boom' }),
      })
    }
    return route.fallback()
  })
  await startPush(page)

  await pinChip(page).click()
  const sheet = page.getByRole('dialog', { name: 'Exercise note' })
  await sheet.getByLabel('Note for Bench Press').fill('seat on 4')
  await sheet.getByRole('button', { name: 'Save' }).click()

  const alert = benchCard(page).getByRole('alert')
  await expect(alert).toContainText('The note for Bench Press was not saved.')
  await expect(cardNote(page)).toHaveCount(0)

  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(cardNote(page)).toContainText('seat on 4')
  await expect(benchCard(page).getByRole('alert')).toHaveCount(0)
  expect(api.exerciseNoteWrites).toEqual([{ exercise_id: bench.id, note: 'seat on 4' }])
})

test('the workout notes stay separate from the pinned note', async ({ page }) => {
  await mockSupabase(page, {
    routines,
    folders,
    exerciseNotes: [{ exercise_id: bench.id, note: 'seat on 4' }],
  })
  await startPush(page)

  await benchCard(page).getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(benchCard(page).getByLabel('Notes for Bench Press')).toHaveValue('')
  await expect(cardNote(page)).toContainText('seat on 4')
})
