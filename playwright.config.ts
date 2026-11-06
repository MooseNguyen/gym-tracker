import { defineConfig, devices } from '@playwright/test'

export const MOCK_SUPABASE_URL = 'https://e2e-mock.supabase.co'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // Service workers would cache across tests and hide network mocks.
    serviceWorkers: 'block',
  },
  projects: [
    // WebKit is the closest thing to iPhone Safari available on a dev machine.
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
})
