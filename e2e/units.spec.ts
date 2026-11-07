import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, mockSupabase } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

const pushDay = {
  id: '00000000-0000-0000-0000-0000000000f1',
  routine_id: null,
  name: 'Push, heavy', // a comma: must stay one CSV field
  started_at: '2026-11-06T18:00:00',
  ended_at: '2026-11-06T18:52:00',
  notes: null,
  workout_exercises: [
    {
      id: 'we1',
      exercise_id: bench.id,
      position: 0,
      notes: null,
      exercise: bench,
      sets: [
        {
          id: 'a',
          position: 0,
          set_type: 'normal',
          weight_kg: 100,
          reps: 5,
          duration_s: null,
          rpe: null,
        },
      ],
    },
  ],
}

async function openMe(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' }).click()
  return page.getByRole('dialog', { name: 'Me' })
}

test('an lb account lifts in lb and the database still gets kg', async ({ page }) => {
  // Last time: 135 lb, stored as 61.25 kg, felt easy.
  const api = await mockSupabase(page, {
    unit: 'lb',
    previous: { weight_kg: 61.25, reps: 8, rpe: 7 },
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  await page.getByRole('button', { name: /^Show all/ }).click()
  await page.getByRole('button', { name: `Select ${bench.name}` }).click()
  await page.getByRole('button', { name: 'Add 1 exercise' }).click()
  const card = page.getByRole('region', { name: bench.name })

  await expect(card.getByRole('columnheader', { name: 'lb' })).toBeVisible()
  await expect(card.locator('td.prev').first()).toHaveText('135 lb × 8')
  // One lb step up (+5 lb), not 2.5 kg = 5.5 lb.
  await expect(card.locator('.suggestion')).toContainText('Try 140 lb × 8')
  await card.getByRole('button', { name: `Apply suggestion for ${bench.name}` }).click()
  await expect(card.getByLabel('Set 1 weight')).toHaveValue('140')

  await card.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.locator('.workout-stats')).toContainText('1,120 lb')
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page).toHaveURL(/\/history\//)

  expect(api.saved[0].exercises[0].sets[0]).toMatchObject({ weight_kg: 63.5, reps: 8 })
  await expect(page.getByRole('cell', { name: '140 lb × 8' })).toBeVisible()
})

test('switching to lb is saved to the account and History follows', async ({ page }) => {
  const api = await mockSupabase(page, { workouts: [pushDay] })
  await page.goto('/history')
  const card = page.getByRole('link', { name: /Push, heavy/ })
  await expect(card).toContainText('best 100 kg × 5')

  const me = await openMe(page)
  const units = me.getByRole('group', { name: 'Weight unit' })
  await expect(units.getByRole('button', { name: 'kg' })).toHaveAttribute('aria-pressed', 'true')
  await units.getByRole('button', { name: 'lb' }).click()
  await expect(units.getByRole('button', { name: 'lb' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')

  await expect(card).toContainText('best 220.5 lb × 5')
  await expect(card.locator('.history-stats')).toContainText('1,102.5 lb') // 220.5 lb × 5
  expect(api.profileWrites).toEqual([{ unit: 'lb' }])
})

test('a workout in progress keeps the unit it started with', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  const me = await openMe(page)
  await me.getByRole('group', { name: 'Weight unit' }).getByRole('button', { name: 'lb' }).click()
  await expect(me).toContainText('The workout in progress stays in kg until you finish it.')
})

test('exports every set as a CSV file', async ({ page }) => {
  await mockSupabase(page, { workouts: [pushDay] })
  await page.goto('/')
  const me = await openMe(page)

  await me.getByRole('button', { name: 'Export workouts (CSV)' }).click()
  await expect(me).toContainText('1 set, weights in kg.')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    me.getByRole('button', { name: /^Save gym-tracker-\d{4}-\d{2}-\d{2}\.csv$/ }).click(),
  ])
  await expect(me).toContainText('Exported.')

  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  const csv = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '')
  expect(csv.trimEnd().split('\r\n')).toEqual([
    'Date,Time,Workout,Exercise,Set,Set type,Weight (kg),Reps,Seconds,RPE,Exercise notes,Workout notes',
    '2026-11-06,18:00,"Push, heavy",Bench Press,1,normal,100,5,,,,',
  ])
})

test('a failed export says why and can be tried again', async ({ page }) => {
  await mockSupabase(page)
  await page.route('**/rest/v1/workouts*', (r) =>
    r.fulfill({ status: 500, json: { message: 'Database is down' } }),
  )
  await page.goto('/')
  const me = await openMe(page)
  await me.getByRole('button', { name: 'Export workouts (CSV)' }).click()
  await expect(me.getByRole('alert')).toHaveText('Export failed: Database is down')
  await expect(me.getByRole('button', { name: 'Export workouts (CSV)' })).toBeEnabled()
})
