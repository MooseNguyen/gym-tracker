/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym',
        description: 'Personal workout tracker',
        theme_color: '#0f110e',
        background_color: '#0f110e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // Precache only the app shell. Workout data always comes from Supabase.
        // Exercise photos (.webp) are left out of the precache on purpose:
        // installing the app should not download ~1 MB of images up front.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Google Fonts: the CSS can change, the font files never do.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cached the first time each photo is shown, then served offline.
            // The files never change in place, so cache-first is safe.
            urlPattern: /\/exercises\/[^/]+\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Photos an admin uploaded (Storage). A new photo always gets a new
            // file name, so these never change in place either.
            urlPattern: /\/storage\/v1\/object\/public\/exercise-images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-uploads',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // A zone with daylight saving, so date tests really cover the DST change
    // (Vietnam has none, which would make them pass for the wrong reason).
    env: {
      TZ: 'Europe/Berlin',
      // Modules that import src/lib/supabase.ts throw without these. Unit
      // tests never call Supabase, so placeholders keep them independent of
      // a developer's .env.local (and of CI, which has none).
      VITE_SUPABASE_URL: 'https://unit-tests.invalid',
      VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    },
  },
})
