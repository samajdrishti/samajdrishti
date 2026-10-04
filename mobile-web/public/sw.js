/* Samaj Drishti service worker.
 *
 * Strategy:
 *   - app shell + static assets: cache-first so the app opens instantly and works
 *     in the field with poor connectivity
 *   - /api calls: network-first, falling back to the last good response so a
 *     dropped connection does not blank the screen
 */
const VERSION = 'samaj-drishti-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    SHELL_ASSETS.includes(url.pathname) ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.startsWith('/icons/');

  if (isApi) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })))
    );
    return;
  }

  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});

/* ------------------------------------------------------------------ push
 * Web Push for new assignments / alerts when the app is closed. The client
 * subscribes with the VAPID public key (see services/push.js) and POSTs the
 * subscription to /api/notifications/push-subscriptions; the server fans out
 * to these endpoints. Until the server is configured with VAPID/FCM keys the
 * toggle in Profile simply reports "not configured".
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Samaj Drishti';
  const options = {
    body: data.body || data.message || 'New update from the Central Monitoring System.',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: data.tag || 'samaj-drishti',
    renotify: true,
    data: { url: data.url || '/alerts' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/alerts';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.includes(self.location.origin)) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
