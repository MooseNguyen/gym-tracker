/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Changes on every build; the saved query cache is dropped when it does. Also
// the Sentry release, so an error's stack is matched to this build's source maps.
const buildId = Date.now().toString(36)

export default defineConfig(({ mode }) => {
  // Every variable, prefixed or not, from the environment (Vercel) and .env
  // files: loadEnv instead of process.env, so no Node types are needed.
  const env = loadEnv(mode, '.', '')
  // Build-time secret (Vercel only, never VITE_-prefixed, so never in the
  // bundle). Without it, nothing is uploaded and no source maps are made.
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN

  return {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
      __APP_ENV__: JSON.stringify(env.VERCEL_ENV || 'local'),
    },
    build: {
      // 'hidden': no sourceMappingURL comment in the files, and the maps are
      // deleted after the upload, so the original source is never served.
      sourcemap: sentryAuthToken ? 'hidden' : false,
    },
    plugins: [
      react(),
      sentryAuthToken
        ? sentryVitePlugin({
            authToken: sentryAuthToken,
            org: env.SENTRY_ORG,
            project: env.SENTRY_PROJECT,
            release: { name: buildId },
            sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
            telemetry: false,
          })
        : null,
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
          // Precache only the app shell (fonts included, ~110 kB). Workout data
          // always comes from Supabase. Exercise photos (.webp) are left out of
          // the precache on purpose: installing the app should not download
          // ~8 MB of images up front.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          // Push and notification-click handlers for the rest-over alert.
          importScripts: ['push-sw.js'],
          runtimeCaching: [
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
  }
})
