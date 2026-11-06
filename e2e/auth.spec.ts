import { expect, test } from '@playwright/test'
import { mockPasswordAuth, mockSupabase } from './mockSupabase'

const account = { email: 'lifter@example.test', password: 'correct-horse-1' }

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
  await mockPasswordAuth(page, account)
})

test('redirects to login, signs in and lands on the page asked for', async ({ page }) => {
  await page.goto('/history')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()

  // The session survives a reload (stored by supabase-js).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
})

test('shows the error for wrong credentials and stays on login', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toContainText('Invalid login credentials')
  await expect(page).toHaveURL(/\/login$/)
})

test('sign-up asks for a strong enough password before calling the server', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'No account? Create one' }).click()
  const password = page.getByLabel('Password')
  await expect(password).toHaveAttribute('autocomplete', 'new-password')

  await page.getByLabel('Email').fill('new@example.test')
  await password.fill('short')
  await page.getByRole('button', { name: 'Create account' }).click()
  // Native validation blocks the submit; the field reports it is invalid.
  expect(await password.evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true)
})

test('reset page explains an expired link when there is no recovery session', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByText('This reset link is invalid or has expired.')).toBeVisible()
})
