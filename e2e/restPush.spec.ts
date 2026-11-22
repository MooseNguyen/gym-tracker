import { expect, test, type Page } from '@playwright/test'
import { fakeLogin, folders, mockSupabase, routines } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  await fakeLogin(page)
})

const ENDPOINT = 'https://web.push.apple.com/e2e-device'

/**
 * Plays the part of an iPhone with the app on its Home Screen: WebKit in
 * Playwright has no push service, and service workers are blocked in e2e.
 * `answer` is what the permission prompt returns.
 */
async function fakeInstalledIphone(
  page: Page,
  {
    answer = 'granted',
    subscribed = false,
  }: { answer?: NotificationPermission; subscribed?: boolean } = {},
) {
  await page.addInitScript(
    ({ answer, subscribed, endpoint }) => {
      const push = { permission: subscribed ? 'granted' : 'default', subscribed }
      const subscription = () => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' } }),
        unsubscribe: async () => {
          push.subscribed = false
          return true
        },
      })
      const pushManager = {
        getSubscription: async () => (push.subscribed ? subscription() : null),
        subscribe: async () => {
          push.subscribed = true
          return subscription()
        },
      }
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
      Object.defineProperty(window, 'PushManager', { value: function PushManager() {} })
      Object.defineProperty(window, 'Notification', {
        value: {
          get permission() {
            return push.permission
          },
          requestPermission: async () => (push.permission = answer),
        },
      })
      Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
        value: async () => ({ pushManager }),
      })
    },
    { answer, subscribed, endpoint: ENDPOINT },
  )
}

async function openMe(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' }).click()
  return page.getByRole('dialog', { name: 'Me' })
}

const alertsSection = (page: Page) =>
  page.getByRole('dialog', { name: 'Me' }).getByRole('region', { name: 'Rest timer alerts' })

test('in a Safari tab on iPhone it says to add the app to the Home Screen', async ({ page }) => {
  await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await openMe(page)
  await expect(alertsSection(page)).toContainText('add the app to your Home Screen first')
  await expect(alertsSection(page).getByRole('button', { name: 'On' })).toHaveCount(0)
})

test('turned on, a rest sends its end to the server; +15 moves it, Skip clears it', async ({
  page,
}) => {
  await fakeInstalledIphone(page)
  const api = await mockSupabase(page, { routines, folders })
  await page.goto('/')

  await openMe(page)
  await alertsSection(page).getByRole('button', { name: 'On' }).click()
  await expect(alertsSection(page).getByRole('button', { name: 'On' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(() => api.pushWrites)
    .toEqual([
      {
        table: 'push_subscriptions',
        op: 'upsert',
        body: { endpoint: ENDPOINT, p256dh: 'e2e-p256dh', auth: 'e2e-auth' },
      },
    ])
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Start Push' }).click()
  await page.getByRole('button', { name: 'Timer', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Timer' })
    .getByRole('button', { name: 'Start 1:00' })
    .click()
  const alerts = () => api.pushWrites.filter((w) => w.table === 'rest_alerts')
  await expect.poll(() => alerts().length).toBe(1)

  await page.getByRole('button', { name: '15 seconds more' }).click()
  await expect.poll(() => alerts().length).toBe(2)
  const [first, second] = alerts()
  expect(first.op).toBe('upsert')
  expect(Date.parse(second.body.fire_at) - Date.parse(first.body.fire_at)).toBe(15_000)

  await page.locator('.rest-timer').getByRole('button', { name: 'Skip' }).click()
  await expect.poll(() => alerts().at(-1)?.op).toBe('delete')
  expect(alerts()).toHaveLength(3)

  // Off: the browser unsubscribes and the server row goes.
  await openMe(page)
  await alertsSection(page).getByRole('button', { name: 'Off' }).click()
  await expect
    .poll(() => api.pushWrites.at(-1))
    .toEqual({ table: 'push_subscriptions', op: 'delete', body: { endpoint: `eq.${ENDPOINT}` } })
})

test('with alerts off, a rest writes nothing to the server', async ({ page }) => {
  await fakeInstalledIphone(page)
  const api = await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Push' }).click()
  await page.getByRole('button', { name: 'Timer', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Timer' })
    .getByRole('button', { name: 'Start 1:00' })
    .click()
  await expect(page.locator('.rest-timer')).toBeVisible()
  expect(api.pushWrites).toEqual([])
})

test('a refused permission explains where to allow it', async ({ page }) => {
  await fakeInstalledIphone(page, { answer: 'denied' })
  const api = await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await openMe(page)
  await alertsSection(page).getByRole('button', { name: 'On' }).click()
  await expect(alertsSection(page)).toContainText('Notifications are blocked')
  await expect(alertsSection(page).getByRole('button', { name: 'On' })).toHaveCount(0)
  expect(api.pushWrites).toEqual([])
})

test('logging out turns alerts off for the next account on this phone', async ({ page }) => {
  await fakeInstalledIphone(page, { subscribed: true })
  const api = await mockSupabase(page, { routines, folders })
  await page.goto('/')
  await openMe(page)
  await expect(alertsSection(page).getByRole('button', { name: 'On' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('dialog', { name: 'Me' }).getByRole('button', { name: 'Log out' }).click()
  await page
    .getByRole('dialog', { name: 'Log out?' })
    .getByRole('button', { name: 'Log out' })
    .click()
  await expect(page).toHaveURL(/\/login$/)
  expect(api.pushWrites.at(-1)).toEqual({
    table: 'push_subscriptions',
    op: 'delete',
    body: { endpoint: `eq.${ENDPOINT}` },
  })
})
