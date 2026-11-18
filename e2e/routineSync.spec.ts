import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

// Push is Bench Press 3 sets, then Overhead Press 3 sets, 90 s rest each.

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

async function startPush(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Push' }).click()
  await expect(page).toHaveURL(/\/workout$/)
}

/** Ticks set `n` of an exercise with weight and reps. */
async function logSet(page: Page, exercise: string, n: number) {
  const card = page.getByRole('region', { name: exercise })
  await card.getByLabel(`Set ${n} weight`).fill('50')
  await card.getByLabel(`Set ${n} reps`).fill('8')
  await card.getByRole('button', { name: `Set ${n} done` }).click()
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish workout' }).click()
}

const updateDialog = (page: Page) => page.getByRole('dialog', { name: 'Update "Push"?' })

test('done as planned: no question, straight to the saved workout', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  for (const exercise of ['Bench Press', 'Overhead Press'])
    for (const n of [1, 2, 3]) await logSet(page, exercise, n)

  await finish(page)
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  await expect(updateDialog(page)).toHaveCount(0)
  expect(api.routineWrites).toEqual([])
})

test('a skipped exercise and an extra set: Update makes the routine match', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  // Bench Press: 4 sets instead of 3. Overhead Press: nothing ticked, so skipped.
  await page
    .getByRole('region', { name: bench.name })
    .getByRole('button', { name: '+ Add set' })
    .click()
  for (const n of [1, 2, 3, 4]) await logSet(page, bench.name, n)

  await finish(page)
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  // The workout is saved before the question.
  await expect.poll(() => api.saved.length).toBe(1)

  const dialog = updateDialog(page)
  await expect(dialog.getByRole('list', { name: 'Changes' }).getByRole('listitem')).toHaveText([
    'Remove Overhead Press',
    'Bench Press: 3 → 4 sets',
  ])
  await dialog.getByRole('button', { name: 'Update routine' }).click()

  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  expect(api.routineWrites).toEqual([
    {
      id: 'r-push',
      name: 'Push',
      notes: null,
      folder_id: 'f-ppl',
      exercises: [{ exercise_id: bench.id, target_sets: 4, rest_seconds: 90 }],
    },
  ])
})

test('Keep routine leaves it as it was', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  for (const n of [1, 2, 3]) await logSet(page, bench.name, n)

  await finish(page)
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await updateDialog(page).getByRole('button', { name: 'Keep routine' }).click()

  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  expect(api.saved).toHaveLength(1)
  expect(api.routineWrites).toEqual([])
})

test('a failed routine update can be retried or skipped; the workout stays saved', async ({
  page,
}) => {
  const api = await mockSupabase(page, { routines, folders })
  let failures = 0
  await page.route('**/rest/v1/rpc/save_routine', (r) => {
    failures++
    return r.fulfill({ status: 500, json: { message: 'Database is down' } })
  })
  await startPush(page)
  for (const n of [1, 2, 3]) await logSet(page, bench.name, n)

  await finish(page)
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await updateDialog(page).getByRole('button', { name: 'Update routine' }).click()

  const failed = page.getByRole('dialog', { name: `Couldn't update "Push"` })
  await expect(failed).toContainText('Your workout is saved.')
  await failed.getByRole('button', { name: 'Try again' }).click()
  await expect.poll(() => failures).toBe(2)
  await page
    .getByRole('dialog', { name: `Couldn't update "Push"` })
    .getByRole('button', { name: 'Skip' })
    .click()

  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  expect(api.saved).toHaveLength(1)
})

test('editing a saved workout never asks about its routine', async ({ page }) => {
  const api = await mockSupabase(page, { routines, folders })
  await startPush(page)
  for (const n of [1, 2, 3]) await logSet(page, bench.name, n)
  await finish(page)
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await updateDialog(page).getByRole('button', { name: 'Keep routine' }).click()
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/workout$/)
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page).toHaveURL(/\/history\/[0-9a-f-]{36}$/)
  await expect(updateDialog(page)).toHaveCount(0)
  expect(api.saved).toHaveLength(1) // saved again under the same id
  expect(api.routineWrites).toEqual([])
})
