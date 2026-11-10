import { expect, test, type Page } from '@playwright/test'
import { MOCK_SUPABASE_URL } from '../playwright.config'
import { bench, fakeLogin, mockExerciseWrites, mockSupabase, photo } from './mockSupabase'

const ownPhotoExercise = {
  id: 'ex-own',
  user_id: null,
  name: 'Iso-Lateral Row',
  muscle_group: 'upper-back',
  equipment: 'machine',
  kind: 'weight_reps',
  image_path: 'own/old-photo.jpg',
  image_path_end: null,
}

async function openNewForm(page: Page) {
  await page.goto('/exercises')
  await page.getByRole('button', { name: '+ New' }).click()
  return page.getByRole('dialog', { name: 'New exercise' })
}

test('members see no admin controls', async ({ page }) => {
  await fakeLogin(page)
  await mockSupabase(page, { exercises: [bench] })
  const form = await openNewForm(page)
  await expect(form.getByLabel('Name')).toBeVisible()
  await expect(form.getByLabel('Built-in (shown to everyone)')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: `Edit ${bench.name}` })).toHaveCount(0)
  await expect(page.getByLabel('Show hidden built-ins')).toHaveCount(0)
})

test('an admin adds a built-in with a photo and steps', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockExerciseWrites(page)
  const form = await openNewForm(page)

  await form.getByLabel('Name').fill('Iso-Lateral Pulldown')
  await form.getByLabel('Muscle group').selectOption('lats')
  await form.getByLabel('Equipment').selectOption('machine')
  await form.getByLabel('Built-in (shown to everyone)').check()

  // Required for a built-in: a start photo and at least one step.
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('Add a start photo.')
  await form.getByLabel('Start photo').setInputFiles(photo())
  await expect(form.getByRole('img', { name: 'Start photo preview' })).toBeVisible()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText('Add at least one step.')
  expect(calls.uploads).toHaveLength(0)

  // Secondary muscles: none from the primary's own group (back) are offered.
  const alsoWorks = form.getByRole('group', { name: 'Also works (counted in weekly stats)' })
  await expect(alsoWorks.getByRole('button', { name: 'upper back' })).toHaveCount(0)
  await alsoWorks.getByRole('button', { name: 'biceps' }).click()
  await expect(alsoWorks.getByRole('button', { name: 'biceps' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await form
    .getByLabel('Steps (one per line)')
    .fill('Sit with your chest on the pad.\n\nPull one handle down to your chest.')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  // Resized on the phone and uploaded under a fresh name.
  expect(calls.uploads).toHaveLength(1)
  expect(calls.uploads[0].path).toMatch(/^own\/[0-9a-f-]{36}\.jpg$/)
  expect(calls.uploads[0].isJpeg).toBe(true)
  expect(calls.writes).toEqual([
    {
      method: 'POST',
      body: {
        name: 'Iso-Lateral Pulldown',
        muscle_group: 'lats',
        equipment: 'machine',
        kind: 'weight_reps',
        instructions: ['Sit with your chest on the pad.', 'Pull one handle down to your chest.'],
        hidden: false,
        secondary_muscles: ['biceps'],
        image_path: calls.uploads[0].path,
        user_id: null, // built-in, not the admin's own custom exercise
      },
    },
  ])
})

test('a built-in name that is taken is refused before anything is uploaded', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockExerciseWrites(page)
  const form = await openNewForm(page)
  await form.getByLabel('Name').fill(bench.name.toUpperCase())
  await form.getByLabel('Built-in (shown to everyone)').check()
  await form.getByLabel('Start photo').setInputFiles(photo())
  await form.getByLabel('Steps (one per line)').fill('Press.')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('alert')).toHaveText(
    `A built-in called "${bench.name.toUpperCase()}" already exists.`,
  )
  expect(calls.uploads).toHaveLength(0)
  expect(calls.writes).toHaveLength(0)
})

test('editing a built-in replaces its photo and removes the old upload', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [ownPhotoExercise] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')
  await page.getByLabel('Search exercises').fill('iso')
  await page.getByRole('button', { name: 'Edit Iso-Lateral Row' }).click()
  const form = page.getByRole('dialog', { name: 'Edit exercise' })

  await expect(form.getByLabel('Name')).toHaveValue('Iso-Lateral Row')
  await form.getByLabel('Name').fill('Iso-Lateral High Row')
  await form.getByLabel('Steps (one per line)').fill('Pull high.')
  await form.getByLabel('Start photo').setInputFiles(photo('new.png'))
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.writes).toHaveLength(1)
  expect(calls.writes[0].method).toBe('PATCH')
  expect(calls.writes[0].body).toMatchObject({
    name: 'Iso-Lateral High Row',
    instructions: ['Pull high.'],
    image_path: calls.uploads[0].path,
  })
  // The end photo was not touched, so it is not part of the update.
  expect(calls.writes[0].body).not.toHaveProperty('image_path_end')
  expect(calls.removed).toEqual([['own/old-photo.jpg']])
})

test('a failed save removes the photo it just uploaded', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockExerciseWrites(page, { failWrite: true })
  const form = await openNewForm(page)
  await form.getByLabel('Name').fill('Iso-Lateral Pulldown')
  await form.getByLabel('Built-in (shown to everyone)').check()
  await form.getByLabel('Start photo').setInputFiles(photo())
  await form.getByLabel('Steps (one per line)').fill('Pull.')
  await form.getByRole('button', { name: 'Save' }).click()

  await expect(form.getByRole('alert')).toHaveText('Database is down')
  await expect(form).toBeVisible() // nothing lost: the admin can retry
  expect(calls.removed).toEqual([[calls.uploads[0].path]])
})

/** A built-in retired by the RepDB switch: hidden, no photo, no steps. */
const retiredBuiltIn = () => ({
  id: 'ex-retired',
  user_id: null,
  name: 'Cable Fly',
  muscle_group: 'chest',
  equipment: 'cable',
  kind: 'weight_reps',
  image_path: null,
  image_path_end: null,
  hidden: true,
})

async function openHiddenList(page: Page) {
  await page.getByLabel('Show hidden built-ins').check()
  return page.getByRole('region', { name: /Hidden built-ins/ })
}

test('an admin unhides a built-in and it is offered again', async ({ page }) => {
  const cableFly = retiredBuiltIn()
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench, cableFly] })
  const calls = await mockExerciseWrites(page)
  // The fixture is the mock's data: a successful update changes what the next read returns.
  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/exercises*`, (route) => {
    if (route.request().method() === 'PATCH') cableFly.hidden = false
    return route.fallback()
  })
  await page.goto('/exercises')

  await page.getByLabel('Search exercises').fill('cable fly')
  const noMatch = page.getByText('No exercises match. Change the filters or the search.')
  await expect(noMatch).toBeVisible()

  const hidden = await openHiddenList(page)
  await expect(hidden.getByRole('listitem')).toHaveText([/Cable Fly/])
  await hidden.getByRole('button', { name: 'Unhide Cable Fly' }).click()

  await expect(hidden.getByText('No hidden built-ins.')).toBeVisible()
  expect(calls.writes).toEqual([{ method: 'PATCH', body: { hidden: false } }])
  // Refetched: back in the main list, so in every picker too.
  await expect(noMatch).toBeHidden()
  await expect(page.getByRole('listitem').filter({ hasText: 'Cable Fly' })).toBeVisible()
})

test('a failed unhide says why and keeps the built-in hidden', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench, retiredBuiltIn()] })
  await mockExerciseWrites(page, { failWrite: true })
  await page.goto('/exercises')

  const hidden = await openHiddenList(page)
  await hidden.getByRole('button', { name: 'Unhide Cable Fly' }).click()
  await expect(hidden.getByRole('alert')).toHaveText('Database is down')
  await expect(hidden.getByRole('button', { name: 'Unhide Cable Fly' })).toBeEnabled()
})

test('editing a hidden built-in keeps it hidden', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench, retiredBuiltIn()] })
  const calls = await mockExerciseWrites(page)
  await page.goto('/exercises')

  const hidden = await openHiddenList(page)
  await hidden.getByRole('button', { name: 'Edit Cable Fly' }).click()
  const form = page.getByRole('dialog', { name: 'Edit exercise' })
  await expect(form.getByLabel('Hidden (no longer offered; history keeps it)')).toBeChecked()

  // A retired built-in has neither, and a built-in needs both.
  await form.getByLabel('Start photo').setInputFiles(photo())
  await form
    .getByLabel('Steps (one per line)')
    .fill('Open the arms wide.\nBring the handles together.')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  expect(calls.writes).toHaveLength(1)
  expect(calls.writes[0].body).toMatchObject({ name: 'Cable Fly', hidden: true })
})
