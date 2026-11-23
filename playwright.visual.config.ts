import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * Screenshots and design measurements of every screen, for comparing a
 * restyle before and after (npm run test:visual). Not part of test:e2e or CI:
 * it asserts nothing about the design, it only records it.
 */
export default defineConfig({
  ...base,
  testMatch: 'visual.capture.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
})
