import { expect, test, type Page } from '@playwright/test'
import { MOCK_SUPABASE_URL } from '../playwright.config'
import { bench, fakeLogin, mockSupabase } from './mockSupabase'

// A real (tiny) PNG, so the browser decodes and resizes it like a phone photo.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBNAMDgwMDAwA+5wP/3XwKqQAAAABJRU5ErkJggg==',
  'base64',
)
const photo = (name = 'machine.png') => ({ name, mimeType: 'image/png', buffer: PNG })

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

interface Calls {
  /** Upload path and whether the file sent is a JPEG. */
  uploads: { path: string; isJpeg: boolean }[]
  removed: string[][]
  writes: { method: string; body: Record<string, unknown> }[]
}

/**
 * Storage and exercise writes on top of mockSupabase (registered after it, so
 * these routes win). `failWrite` makes the row insert/update fail.
 */
async function mockAdminWrites(page: Page, { failWrite = false } = {}): Promise<Calls> {
  const calls: Calls = { uploads: [], removed: [], writes: [] }
  const bucket = `${MOCK_SUPABASE_URL}/storage/v1/object/exercise-images`
  await page.route(`${bucket}/**`, (route) => {
    const req = route.request()
    calls.uploads.push({
      path: new URL(req.url()).pathname.replace('/storage/v1/object/exercise-images/', ''),
      isJpeg: isJpegUpload(req.headers()['content-type'], req.postDataBuffer()),
    })
    return route.fulfill({ status: 200, json: { Key: 'ok', Id: 'ok' } })
  })
  await page.route(bucket, (route) => {
    const { prefixes } = route.request().postDataJSON() as { prefixes: string[] }
    calls.removed.push(prefixes)
    return route.fulfill({ status: 200, json: [] })
  })
  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/exercises*`, (route) => {
    const req = route.request()
    if (req.method() === 'GET') return route.fallback()
    const body = req.postDataJSON() as Record<string, unknown>
    calls.writes.push({ method: req.method(), body })
    if (failWrite) return route.fulfill({ status: 500, json: { message: 'Database is down' } })
    return route.fulfill({ status: 201, json: [{ id: 'ex-new', ...body }] })
  })
  return calls
}

/** Sent as image/jpeg, and the bytes are a JPEG (they start with FF D8 FF). */
function isJpegUpload(contentType: string | undefined, body: Buffer | null) {
  return (
    contentType === 'image/jpeg' &&
    !!body &&
    body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  )
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
})

test('an admin adds a built-in with a photo and steps', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockAdminWrites(page)
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
        image_path: calls.uploads[0].path,
        user_id: null, // built-in, not the admin's own custom exercise
      },
    },
  ])
})

test('a built-in name that is taken is refused before anything is uploaded', async ({ page }) => {
  await fakeLogin(page, { admin: true })
  await mockSupabase(page, { exercises: [bench] })
  const calls = await mockAdminWrites(page)
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
  const calls = await mockAdminWrites(page)
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
  const calls = await mockAdminWrites(page, { failWrite: true })
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
