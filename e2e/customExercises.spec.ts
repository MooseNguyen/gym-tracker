import { expect, test, type Page } from '@playwright/test'
import {
  bench,
  customCurl,
  E2E_USER_ID,
  fakeLogin,
  mockExerciseWrites,
  mockSupabase,
  photo,
} from './mockSupabase'

// A member's photos go in their own Storage folder (RLS allows nothing else).
const OWN_UPLOAD = new RegExp(`^user/${E2E_USER_ID}/[0-9a-f-]{36}\\.jpg$`)
const OLD_PHOTO = `user/${E2E_USER_ID}/old-photo.jpg`
const curlWithPhoto = { ...customCurl, image_path: OLD_PHOTO }

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

/** The Exercises page lists exercises once searched (or browsed). */
async function findExercise(page: Page, name: string) {
  await page.goto('/exercises')
  await page.getByLabel('Search exercises').fill(name)
}

async function openEditForm(page: Page, name: string) {
  await findExercise(page, name)
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  return page.getByRole('dialog', { name: 'Edit exercise' })
}

test('a member adds a custom exercise with a photo', async ({ page }) => {
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')
  await page.getByRole('button', { name: '+ New' }).click()
  const form = page.getByRole('dialog', { name: 'New exercise' })

  await form.getByLabel('Name').fill('Landmine Press')
  await form.getByLabel('Muscle group').selectOption('front-delts')
  await form.getByLabel('Equipment').selectOption('barbell')
  await expect(form.getByText('Anyone with the link can see this photo.')).toBeVisible()
  await form.getByLabel('Photo (optional)').setInputFiles(photo())
  await expect(form.getByRole('img', { name: 'Photo (optional) preview' })).toBeVisible()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.uploads).toHaveLength(1)
  expect(calls.uploads[0].path).toMatch(OWN_UPLOAD)
  expect(calls.uploads[0].isJpeg).toBe(true)
  expect(calls.writes).toEqual([
    {
      method: 'POST',
      body: {
        name: 'Landmine Press',
        muscle_group: 'front-delts',
        equipment: 'barbell',
        kind: 'weight_reps',
        image_path: calls.uploads[0].path,
      },
    },
  ])
})

test('a member edits only their own exercises, and the kind stays as it is', async ({ page }) => {
  await mockSupabase(page, { exercises: [bench, curlWithPhoto] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')
  await page.getByRole('button', { name: 'Show all 2' }).click()
  await expect(page.getByRole('button', { name: `Edit ${customCurl.name}` })).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit ${bench.name}` })).toHaveCount(0)

  const form = await openEditForm(page, customCurl.name)
  await expect(form.getByLabel('Name')).toHaveValue(customCurl.name)
  await expect(form.getByLabel('Built-in (shown to everyone)')).toHaveCount(0)
  const kind = form.getByLabel('Tracked as')
  await expect(kind).toBeDisabled()
  await expect(kind).toHaveAccessibleDescription(/Fixed once created/)

  await form.getByLabel('Name').fill('Cable Curl (rope)')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  // No kind and no photo change in the update; nothing uploaded or removed.
  expect(calls.writes).toEqual([
    {
      method: 'PATCH',
      body: { name: 'Cable Curl (rope)', muscle_group: 'biceps', equipment: 'cable' },
    },
  ])
  expect(calls.uploads).toHaveLength(0)
  expect(calls.removed).toHaveLength(0)
})

test('replacing the photo uploads the new one and removes the old one', async ({ page }) => {
  await mockSupabase(page, { exercises: [curlWithPhoto] })
  const calls = await mockExerciseWrites(page)
  const form = await openEditForm(page, customCurl.name)

  await form.getByLabel('Photo (optional)').setInputFiles(photo('new.png'))
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.uploads[0].path).toMatch(OWN_UPLOAD)
  expect(calls.writes[0].body.image_path).toBe(calls.uploads[0].path)
  expect(calls.removed).toEqual([[OLD_PHOTO]])
})

test('removing the photo clears it and deletes the file', async ({ page }) => {
  await mockSupabase(page, { exercises: [curlWithPhoto] })
  const calls = await mockExerciseWrites(page)
  const form = await openEditForm(page, customCurl.name)

  await form.getByRole('button', { name: 'Remove' }).click()
  await expect(form.getByRole('img', { name: 'Photo (optional) preview' })).toHaveCount(0)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.uploads).toHaveLength(0)
  expect(calls.writes[0].body).toMatchObject({ image_path: null })
  expect(calls.removed).toEqual([[OLD_PHOTO]])
})

test('a failed save says so and removes the photo it just uploaded', async ({ page }) => {
  await mockSupabase(page, { exercises: [curlWithPhoto] })
  const calls = await mockExerciseWrites(page, { failWrite: true })
  const form = await openEditForm(page, customCurl.name)

  await form.getByLabel('Photo (optional)').setInputFiles(photo())
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('Database is down')
  await expect(form).toBeVisible()

  // The new upload is cleaned up; the photo the exercise still has is kept.
  expect(calls.removed).toEqual([[calls.uploads[0].path]])
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

  test('deletes its photo too', async ({ page }) => {
    await mockSupabase(page, { exercises: [curlWithPhoto] })
    const calls = await mockExerciseWrites(page)
    await deleteCurl(page)

    await expect.poll(() => calls.removed).toEqual([[OLD_PHOTO]])
    expect(calls.deletes).toEqual([customCurl.id])
  })

  test('one used in history stays, and so does its photo', async ({ page }) => {
    await mockSupabase(page, { exercises: [curlWithPhoto] })
    const calls = await mockExerciseWrites(page, { deleteInUse: true })
    await deleteCurl(page)

    await expect(page.getByRole('alert')).toHaveText(
      'This exercise is used in a routine or workout history.',
    )
    expect(calls.removed).toHaveLength(0)
  })
})
