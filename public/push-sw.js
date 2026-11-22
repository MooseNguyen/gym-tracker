// Loaded into the generated service worker (vite.config.ts → workbox.importScripts).
// Shows the "Rest over" push sent by the rest-alerts Edge Function.
//
// iOS requires every push to show a notification (userVisibleOnly), so this
// always shows one, even when the app is open: the in-app timer and the
// banner then say the same thing, which is harmless.

const REST_TAG = 'rest-over'

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Not JSON: fall back to the default text below.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rest over', {
      body: data.body || 'Time for your next set.',
      icon: '/apple-touch-icon.png',
      // One rest banner at a time: a new one replaces the last, and still alerts.
      tag: REST_TAG,
      renotify: true,
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Bring the open app forward instead of starting a second copy.
      for (const client of windows) {
        if ('focus' in client) {
          // Already on the workout: no reload, just show it.
          if (new URL(client.url).pathname !== url) client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
