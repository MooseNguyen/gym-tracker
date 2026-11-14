import { expect, test, type Page } from '@playwright/test'
import { MOCK_SENTRY_HOST } from '../playwright.config'
import { bench, fakeLogin, mockSupabase, user } from './mockSupabase'

interface SentryEvent {
  exception?: { values?: { type?: string; value?: string }[] }
  user?: Record<string, unknown>
  request?: Record<string, unknown>
  breadcrumbs?: unknown
}

/** Error events the app sends to Sentry (an envelope is newline-delimited JSON). */
async function captureSentry(page: Page) {
  const events: SentryEvent[] = []
  const raw: string[] = []
  await page.route(`https://${MOCK_SENTRY_HOST}/**`, (route) => {
    const body = route.request().postData() ?? ''
    raw.push(body)
    const lines = body.split('\n').filter(Boolean)
    // Header, then pairs of item header + item payload.
    for (let i = 1; i + 1 < lines.length; i += 2) {
      if ((JSON.parse(lines[i]) as { type?: string }).type === 'event')
        events.push(JSON.parse(lines[i + 1]) as SentryEvent)
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  return { events, raw }
}

const message = (e: SentryEvent) => e.exception?.values?.[0]?.value ?? ''

/** An empty workout with one ticked bench set of 60 × 10. */
async function oneTickedSet(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  await page.getByRole('button', { name: /^Show all/ }).click()
  await page.getByRole('button', { name: `Select ${bench.name}` }).click()
  await page.getByRole('button', { name: 'Add 1 exercise' }).click()
  const card = page.getByRole('region', { name: bench.name })
  await card.getByLabel('Set 1 weight').fill('60')
  await card.getByLabel('Set 1 reps').fill('10')
  await card.getByRole('button', { name: 'Set 1 done' }).click()
}

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

test('a crashed page is reported with the account UUID and nothing personal', async ({ page }) => {
  const sentry = await captureSentry(page)
  await mockSupabase(page)
  // A page whose code fails to download crashes while rendering.
  await page.route('**/src/features/history/WorkoutDetailPage.tsx*', (r) => r.abort())
  await page.goto('/history/00000000-0000-0000-0000-0000000000e1')
  await expect(page.getByRole('alert')).toContainText('Something went wrong')

  await expect.poll(() => sentry.events.length).toBeGreaterThan(0)
  const event = sentry.events[0]
  // WebKit's wording for a chunk that failed to download.
  expect(message(event)).toContain('Importing a module script failed')
  expect(event.user).toEqual({ id: user.id })
  // Not the email, not the session token, anywhere in what was sent.
  const sent = sentry.raw.join('\n')
  expect(sent).not.toContain(user.email)
  expect(sent).not.toContain('e2e.fake.token')
})

test('a save the server refuses is reported', async ({ page }) => {
  const sentry = await captureSentry(page)
  await mockSupabase(page)
  await page.route('**/rest/v1/rpc/save_workout', (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'boom' }),
    }),
  )
  await oneTickedSet(page)
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('alert')).toContainText('Saving failed')

  await expect.poll(() => sentry.events.map(message)).toContain('boom')
  // The workout itself (the request body) is not sent.
  expect(sentry.raw.join('\n')).not.toContain('"weight_kg"')
})

test('a page that failed for lack of signal is not reported', async ({ page }) => {
  const sentry = await captureSentry(page)
  await mockSupabase(page)
  // The history list never gets an answer, retry included.
  await page.route('**/rest/v1/workouts*', (r) => r.abort('internetdisconnected'))
  await page.goto('/history')
  // supabase-js retries a failed GET 3 times (1 + 2 + 4 s), then TanStack
  // once more: about 15 s before the page gives up.
  test.setTimeout(60_000)
  await expect(page.getByRole('alert')).toContainText('Something went wrong', { timeout: 40_000 })

  // Reports are sent right away; give one the time it would need.
  await page.waitForTimeout(1000)
  expect(sentry.events).toEqual([])
})
