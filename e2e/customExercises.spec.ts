import { expect, test, type Page } from '@playwright/test'
import { bench, customCurl, fakeLogin, mockExerciseWrites, mockSupabase } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

/** The Exercises page lists exercises once searched (or browsed). */
async function findExercise(page: Page, name: string) {
  await page.goto('/exercises')
  await page.getByLabel('Search exercises').fill(name)
}

test('a member adds a custom exercise, with no photo field', async ({ page }) => {
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')
  await page.getByRole('button', { name: '+ New' }).click()
  const form = page.getByRole('dialog', { name: 'New exercise' })

  await form.getByLabel('Name').fill('Landmine Press')
  await form.getByLabel('Muscle group').selectOption('front-delts')
  await form.getByLabel('Equipment').selectOption('barbell')
  await expect(form.getByLabel(/photo/i)).toHaveCount(0)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.uploads).toHaveLength(0)
  expect(calls.writes).toEqual([
    {
      method: 'POST',
      body: {
        name: 'Landmine Press',
        muscle_group: 'front-delts',
        equipment: 'barbell',
        kind: 'weight_reps',
      },
    },
  ])
})

test('a member edits only their own exercises, and the kind stays as it is', async ({ page }) => {
  await mockSupabase(page, { exercises: [bench, customCurl] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')
  await page.getByRole('button', { name: 'Show all 2' }).click()
  await expect(page.getByRole('button', { name: `Edit ${customCurl.name}` })).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${bench.name}` })).toHaveCount(0)

  await findExercise(page, customCurl.name)
  await page.getByRole('button', { name: `Edit ${customCurl.name}` }).click()
  const form = page.getByRole('dialog', { name: 'Edit exercise' })
  await expect(form.getByLabel('Name')).toHaveValue(customCurl.name)
  await expect(form.getByLabel('Built-in (shown to everyone)')).toHaveCount(0)
  await expect(form.getByLabel(/photo/i)).toHaveCount(0)
  const kind = form.getByLabel('Tracked as')
  await expect(kind).toBeDisabled()
  await expect(kind).toHaveAccessibleDescription(/Fixed once created/)

  await form.getByLabel('Name').fill('Cable Curl (rope)')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  // No kind in the update: past sets were logged for it.
  expect(calls.writes).toEqual([
    {
      method: 'PATCH',
      body: { name: 'Cable Curl (rope)', muscle_group: 'biceps', equipment: 'cable' },
    },
  ])
})

test.describe('deleting a custom exercise', () => {
  async function deleteCurl(page: Page) {
    await findExercise(page, customCurl.name)
    await page.getByRole('button', { name: `Delete ${customCurl.name}` }).click()
    await page
      .getByRole('dialog', { name: `Delete "${customCurl.name}"?` })
      .getByRole('button', { name: 'Delete' })
      .click()
  }

  test('removes it', async ({ page }) => {
    await mockSupabase(page, { exercises: [customCurl] })
    const calls = await mockExerciseWrites(page)
    await deleteCurl(page)

    await expect.poll(() => calls.deletes).toEqual([customCurl.id])
    expect(calls.removed).toHaveLength(0)
  })

  test('one used in history stays, with a clear error', async ({ page }) => {
    await mockSupabase(page, { exercises: [customCurl] })
    await mockExerciseWrites(page, { deleteInUse: true })
    await deleteCurl(page)

    await expect(page.getByRole('alert')).toHaveText(
      'This exercise is used in a routine or workout history.',
    )
  })
})
