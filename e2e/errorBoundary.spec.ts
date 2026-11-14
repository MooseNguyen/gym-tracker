import { expect, test, type Page } from '@playwright/test'
import { bench, fakeLogin, mockSupabase } from './mockSupabase'

const legDay = {
  id: '00000000-0000-0000-0000-0000000000e1',
  routine_id: null,
  name: 'Leg day',
  started_at: '2026-11-06T18:00:00',
  ended_at: '2026-11-06T18:45:00',
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

// The workout detail page is a lazy chunk. Failing its download is what
// happens offline, or when a deploy has removed the chunk an old tab expects.
const DETAIL_CHUNK = '**/src/features/history/WorkoutDetailPage.tsx*'

async function openDetailWithoutItsCode(page: Page) {
  await page.route(DETAIL_CHUNK, (route) => route.abort())
  await page.goto(`/history/${legDay.id}`)
  await expect(page.getByRole('alert')).toContainText('Something went wrong')
}

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
  await mockSupabase(page, { workouts: [legDay] })
})

test('a page whose code fails to load shows an error screen, and Reload brings it back', async ({
  page,
}) => {
  await openDetailWithoutItsCode(page)
  // Reassures instead of a blank page, and leaks nothing about the error.
  await expect(page.getByRole('alert')).toContainText('still saved on this phone')
  await expect(page.getByRole('alert')).not.toContainText('dynamically imported')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

  await page.unroute(DETAIL_CHUNK)
  await page.getByRole('button', { name: 'Reload' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Leg day')).toBeVisible()
})

test('another tab clears the error screen', async ({ page }) => {
  await openDetailWithoutItsCode(page)

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'History' })
    .click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Leg day')).toBeVisible()
})
