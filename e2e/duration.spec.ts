import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

const MIN = 60_000

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

async function startPushWithOneSet(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Push' }).click()
  const card = page.getByRole('region', { name: bench.name })
  await card.getByLabel('Set 1 weight').fill('60')
  await card.getByLabel('Set 1 reps').fill('8')
  await card.getByRole('button', { name: 'Set 1 done' }).click()
}

/** Opens the Duration sheet and picks hours and minutes on its wheels. */
async function pickDuration(page: Page, hours: number, minutes: number) {
  await page.getByRole('button', { name: /^Duration .*, change$/ }).click()
  await pickDurationInOpenSheet(page, hours, minutes)
  return page.getByRole('dialog', { name: 'Duration' })
}

const durationStat = (page: Page) => page.getByRole('button', { name: /^Duration .*, change$/ })

test('forgot to press Finish: the set duration stays and ends the workout', async ({ page }) => {
  await page.clock.install()
  const api = await mockSupabase(page, { routines, folders })
  await startPushWithOneSet(page)

  await page.clock.fastForward(3 * 60 * MIN)
  await expect(durationStat(page)).toHaveText(/^3:00:\d\d$/)

  const sheet = await pickDuration(page, 1, 10)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Duration (set)')).toBeVisible()
  await expect(durationStat(page)).toHaveText('1:10:00')
  // No longer follows the clock.
  await page.clock.fastForward(10 * MIN)
  await expect(durationStat(page)).toHaveText('1:10:00')

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish' })
    .click()
  await page
    .getByRole('dialog', { name: 'Update "Push"?' })
    .getByRole('button', { name: 'Keep routine' })
    .click()
  await expect(page).toHaveURL(/\/history\//)

  const [w] = api.saved
  expect(Date.parse(w.ended_at) - Date.parse(w.started_at)).toBe(70 * MIN)
})

test('Use live time goes back to the running clock', async ({ page }) => {
  await page.clock.install()
  await mockSupabase(page, { routines, folders })
  await startPushWithOneSet(page)
  await page.clock.fastForward(2 * 60 * MIN)

  let sheet = await pickDuration(page, 0, 45)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(durationStat(page)).toHaveText('45:00')

  await durationStat(page).click()
  sheet = page.getByRole('dialog', { name: 'Duration' })
  await sheet.getByRole('button', { name: 'Use live time' }).click()
  await expect(page.getByText('Duration (set)')).toHaveCount(0)
  await expect(durationStat(page)).toHaveText(/^2:00:\d\d$/)
})

test('longer than the time since the start is refused', async ({ page }) => {
  await page.clock.install()
  await mockSupabase(page, { routines, folders })
  await startPushWithOneSet(page)
  await page.clock.fastForward(20 * MIN)

  const sheet = await pickDuration(page, 1, 0)
  await expect(sheet.getByRole('alert')).toHaveText(
    'At most 20 min: the time since the workout started.',
  )
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()

  await pickDurationInOpenSheet(page, 0, 0)
  await expect(sheet.getByRole('alert')).toHaveText('At least 1 minute.')
})

/** Same wheels, sheet already open. */
async function pickDurationInOpenSheet(page: Page, hours: number, minutes: number) {
  const sheet = page.getByRole('dialog', { name: 'Duration' })
  for (const [label, value] of [
    ['Hours', hours],
    ['Minutes', minutes],
  ] as const) {
    await sheet.getByRole('spinbutton', { name: label }).focus()
    await page.keyboard.press('Home') // 0
    for (let i = 0; i < value; i++) await page.keyboard.press('ArrowDown')
  }
}

test('a saved workout: the duration changes, the start stays', async ({ page }) => {
  const started = '2026-11-16T18:00:00.000Z'
  const saved = {
    id: '00000000-0000-0000-0000-0000000000d1',
    routine_id: null,
    name: 'Evening',
    started_at: started,
    ended_at: '2026-11-16T19:30:00.000Z',
    notes: null,
    workout_exercises: [
      {
        id: 'we-1',
        exercise_id: bench.id,
        position: 0,
        notes: null,
        exercise: bench,
        sets: [
          {
            id: 's-1',
            position: 0,
            set_type: 'normal',
            weight_kg: 60,
            reps: 8,
            duration_s: null,
            rpe: null,
          },
        ],
      },
    ],
  }
  const api = await mockSupabase(page, { workouts: [saved] })
  await page.goto(`/history/${saved.id}`)
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/workout$/)
  await expect(durationStat(page)).toHaveText('1:30:00')
  // Editing a saved workout: no running clock to go back to.
  await durationStat(page).click()
  await expect(
    page.getByRole('dialog', { name: 'Duration' }).getByRole('button', { name: 'Use live time' }),
  ).toHaveCount(0)
  await pickDurationInOpenSheet(page, 0, 45)
  await page.getByRole('dialog', { name: 'Duration' }).getByRole('button', { name: 'Save' }).click()
  await expect(durationStat(page)).toHaveText('45:00')

  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(new RegExp(`/history/${saved.id}$`))
  expect(api.saved[0].started_at).toBe(started)
  expect(api.saved[0].ended_at).toBe('2026-11-16T18:45:00.000Z')
})
